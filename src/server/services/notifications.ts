import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications, users, type User } from "@/db/schema";
import { testSummaryEmail } from "@/lib/email-templates";
import { addDays } from "@/lib/dates";
import { occurrencesBetween } from "@/lib/schedule";
import { env } from "../env";
import { ApiError } from "../http";
import { sendMail } from "../mailer";
import { listSubscriptions } from "./subscriptions";

// การตั้งค่าแจ้งเตือน, กระดิ่งในเว็บ (US-E3) และอีเมลทดสอบ (US-E4) — ทุกอย่าง scope ด้วย userId

export type NotificationDto = {
  id: number;
  type: "billing_reminder" | "trial_ending" | "member_reminder" | "test";
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

/** การตั้งค่าแจ้งเตือนของผู้ใช้ */
export function settingsOf(u: User) {
  return { notifyEnabled: u.notifyEnabled, notifyDaysBefore: u.notifyDaysBefore as 1 | 3 | 7 };
}

/** แก้การตั้งค่าแจ้งเตือน */
export async function updateSettings(
  userId: number,
  patch: { notifyEnabled?: boolean; notifyDaysBefore?: 1 | 3 | 7 },
) {
  if (Object.keys(patch).length > 0) await db.update(users).set(patch).where(eq(users.id, userId));
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return settingsOf(u);
}

/** การแจ้งเตือนในเว็บ ใหม่ → เก่า พร้อมจำนวนที่ยังไม่อ่าน */
export async function listNotifications(userId: number, opts: { unreadOnly?: boolean; limit?: number }) {
  const mine = and(eq(notifications.userId, userId), eq(notifications.channel, "in_app"));
  const [rows, [{ n }]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(and(mine, opts.unreadOnly ? isNull(notifications.readAt) : undefined))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(Math.min(Math.max(opts.limit ?? 20, 1), 100)),
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(mine, isNull(notifications.readAt))),
  ]);
  const data: NotificationDto[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    link: r.link,
    readAt: r.readAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
  return { data, unreadCount: n };
}

/** ทำเครื่องหมายว่าอ่านแล้ว — ไม่ใช่ของตัวเองได้ 404 */
export async function markRead(userId: number, id: number) {
  const [result] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(notifications.id, id), eq(notifications.userId, userId), eq(notifications.channel, "in_app")),
    );
  if (result.affectedRows === 0) throw new ApiError(404, "NOT_FOUND", "ไม่พบการแจ้งเตือนนี้");
}

/** อ่านทั้งหมด */
export async function markAllRead(userId: number) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.channel, "in_app"),
        isNull(notifications.readAt),
      ),
    );
}

/**
 * ส่งอีเมลทดสอบทันที (US-E4): สรุปรายการใน 30 วันข้างหน้า ไม่สนการตั้งค่าล่วงหน้า
 * บันทึกเป็น type=test ซึ่ง due_date เป็น null จึงไม่ไปชนตัวกันส่งซ้ำของอีเมลจริง
 */
export async function sendTestEmail(user: User, today: string) {
  const items = occurrencesBetween(await listSubscriptions(user.id, "active"), today, addDays(today, 30));
  const mail = testSummaryEmail({
    today,
    items: items.map((i) => ({ name: i.name, amount: i.amount, date: i.date, kind: i.kind })),
    appUrl: env.APP_URL,
    settingsUrl: `${env.APP_URL}/settings`,
  });
  const record = {
    userId: user.id,
    type: "test" as const,
    channel: "email" as const,
    title: mail.subject,
    body: mail.text.slice(0, 1000),
    attempts: 1,
  };
  try {
    await sendMail({ to: user.email, subject: mail.subject, html: mail.html, text: mail.text });
  } catch (err) {
    console.error("[test-email] ส่งไม่สำเร็จ", err);
    await db.insert(notifications).values({ ...record, status: "failed" });
    throw new ApiError(
      500,
      "EMAIL_FAILED",
      "ส่งอีเมลไม่สำเร็จ ตรวจ SMTP_USER / SMTP_PASS (App Password) ใน .env แล้วลองใหม่",
    );
  }
  await db.insert(notifications).values({ ...record, status: "sent" });
  return { sentTo: user.email, itemCount: items.length };
}
