import "server-only";
import { count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { feedback, notifications, users } from "@/db/schema";
import {
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_STEPS,
  type FeedbackCreate,
  type FeedbackStatus,
  type FeedbackUpdate,
} from "@/lib/validation/feedback";
import { ApiError } from "../http";

// รายงานปัญหา / คำแนะนำ: ผู้ใช้ส่งจากหน้าตั้งค่า, admin อ่าน ตอบกลับ และเปลี่ยนสถานะในหลังบ้าน

export const FEEDBACK_PAGE_SIZE = 20;

type Kind = FeedbackCreate["kind"];
type Status = FeedbackStatus;

export type FeedbackDto = {
  id: number;
  kind: Kind;
  message: string;
  status: Status;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
};
export type AdminFeedbackDto = FeedbackDto & { user: { id: number; name: string; email: string } };

const columns = {
  id: feedback.id,
  kind: feedback.kind,
  message: feedback.message,
  status: feedback.status,
  reply: feedback.reply,
  repliedAt: feedback.repliedAt,
  createdAt: feedback.createdAt,
};

type Row = { createdAt: Date; repliedAt: Date | null };

/** แปลงวันที่ในแถวเป็น ISO string */
function dates<T extends Row>(r: T): Omit<T, keyof Row> & { createdAt: string; repliedAt: string | null } {
  return { ...r, createdAt: r.createdAt.toISOString(), repliedAt: r.repliedAt?.toISOString() ?? null };
}

/** บันทึกข้อความใหม่ของผู้ใช้ */
export async function createFeedback(userId: number, input: FeedbackCreate): Promise<FeedbackDto> {
  const [{ id }] = await db
    .insert(feedback)
    .values({ userId, ...input })
    .$returningId();
  const [row] = await db.select(columns).from(feedback).where(eq(feedback.id, id));
  return dates(row);
}

/** ข้อความที่ผู้ใช้คนนี้เคยส่ง (ล่าสุดก่อน) พร้อมคำตอบจากทีม */
export async function listMyFeedback(userId: number, limit = 5): Promise<FeedbackDto[]> {
  const rows = await db
    .select(columns)
    .from(feedback)
    .where(eq(feedback.userId, userId))
    .orderBy(desc(feedback.createdAt), desc(feedback.id))
    .limit(limit);
  return rows.map(dates);
}

/** หลังบ้าน: ทุกข้อความพร้อมผู้ส่ง กรองตามสถานะ (ได้หลายค่า) แบ่งหน้า (ใหม่ → เก่า) */
export async function listFeedback(opts: { statuses?: Status[]; page?: number }) {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const where = opts.statuses?.length ? inArray(feedback.status, opts.statuses) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ ...columns, userId: users.id, userName: users.name, userEmail: users.email })
      .from(feedback)
      .innerJoin(users, eq(feedback.userId, users.id))
      .where(where)
      .orderBy(desc(feedback.createdAt), desc(feedback.id))
      .limit(FEEDBACK_PAGE_SIZE)
      .offset((page - 1) * FEEDBACK_PAGE_SIZE),
    db.select({ total: count() }).from(feedback).where(where),
  ]);
  const data: AdminFeedbackDto[] = rows.map(({ userId, userName, userEmail, ...r }) => ({
    ...dates(r),
    user: { id: userId, name: userName, email: userEmail },
  }));
  return { data, meta: { page, pageSize: FEEDBACK_PAGE_SIZE, total } };
}

/** จำนวนข้อความที่ยังไม่ได้เปิดอ่าน (ตัวเลขข้างเมนูหลังบ้าน) */
export async function countNewFeedback(): Promise<number> {
  const [{ total }] = await db.select({ total: count() }).from(feedback).where(eq(feedback.status, "new"));
  return total;
}

/**
 * admin เปลี่ยนสถานะ และ/หรือ ตอบกลับ
 * ตอบกลับ = อ่านแล้วอย่างน้อย (ถ้ายังเป็น "ใหม่") · ตอบหรือขยับขั้น (รับเรื่อง/กำลังแก้ไข/แก้ไขเรียบร้อย)
 * → แจ้งเตือนที่กระดิ่งของผู้ส่ง 1 รายการ พาไปดูในหน้าตั้งค่า
 */
export async function updateFeedback(id: number, input: FeedbackUpdate): Promise<FeedbackDto> {
  const [current] = await db
    .select({ userId: feedback.userId, status: feedback.status })
    .from(feedback)
    .where(eq(feedback.id, id));
  if (!current) throw new ApiError(404, "NOT_FOUND", "ไม่พบข้อความนี้");

  const status = input.status ?? (input.reply && current.status === "new" ? "read" : current.status);
  await db.transaction(async (tx) => {
    await tx
      .update(feedback)
      .set({ status, ...(input.reply && { reply: input.reply, repliedAt: new Date() }) })
      .where(eq(feedback.id, id));
    const stepChanged = status !== current.status && (FEEDBACK_STEPS as readonly string[]).includes(status);
    if (input.reply || stepChanged) {
      const step = stepChanged ? `สถานะ: ${FEEDBACK_STATUS_LABEL[status]}` : "";
      const reply = input.reply
        ? input.reply.length > 180
          ? `${input.reply.slice(0, 179)}…`
          : input.reply
        : "";
      await tx.insert(notifications).values({
        userId: current.userId,
        type: "feedback_reply", // ใช้ชนิดเดียวสำหรับทั้งตอบกลับและอัปเดตสถานะของข้อความแจ้งปัญหา
        channel: "in_app",
        status: "sent",
        title: input.reply
          ? "ทีมพัฒนาตอบกลับข้อความของคุณแล้ว"
          : `ทีมพัฒนาอัปเดตเรื่องที่คุณแจ้ง: ${FEEDBACK_STATUS_LABEL[status]}`,
        body: reply ? [step, reply].filter(Boolean).join(" · ") : "กดเพื่อดูความคืบหน้าในหน้าตั้งค่า",
        link: "/settings#feedback-heading",
      });
    }
  });
  const [row] = await db.select(columns).from(feedback).where(eq(feedback.id, id));
  return dates(row);
}
