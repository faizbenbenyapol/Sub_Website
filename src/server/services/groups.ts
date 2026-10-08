import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { isDuplicateKey } from "@/db/errors";
import {
  groupMembers,
  memberPayments,
  plans,
  services,
  shareGroups,
  userSubscriptions,
  users,
} from "@/db/schema";
import { formatThaiMonth, todayInBangkok } from "@/lib/dates";
import { escapeHtml } from "@/lib/email-templates";
import { formatBaht, fromSatang, satangToDecimal, toSatang } from "@/lib/money";
import { maskPromptpayId, promptpayPayload } from "@/lib/promptpay";
import { splitEqual, validateCustomSplit } from "@/lib/split";
import type { GroupCreate, MemberInput } from "@/lib/validation/group";
import { env } from "../env";
import { ApiError } from "../http";
import { sendMail } from "../mailer";

// หารค่าบริการ (US-F1–F3) — ทุกฟังก์ชันของเจ้าของกรองด้วย owner_id ใน SQL; หน้าจ่ายเงินเข้าถึงด้วย token เท่านั้น

export type GroupMemberDto = {
  id: number;
  name: string;
  email: string | null;
  amount: number;
  payUrl: string;
  status: "paid" | "unpaid";
  paidAt: string | null;
  remindedAt: string | null;
};
export type GroupSummaryDto = {
  id: number;
  name: string;
  subscription: { id: number; name: string; logoUrl: string | null };
  total: number;
  memberCount: number;
  paidCount: number;
  period: string;
};
export type GroupDetailDto = GroupSummaryDto & {
  promptpayIdMasked: string;
  splitMode: "equal" | "custom";
  ownerAmount: number;
  members: GroupMemberDto[];
};

const notFound = () => new ApiError(404, "NOT_FOUND", "ไม่พบกลุ่มนี้");
const newToken = () => randomBytes(32).toString("base64url"); // 43 ตัวอักษร เดาไม่ได้
export const currentPeriod = () => todayInBangkok().slice(0, 7);

/** กลุ่มของเจ้าของพร้อมรายการที่หาร — ไม่ใช่ของตัวเองโยน 404 */
async function loadGroup(ownerId: number, groupId: number) {
  const [row] = await db
    .select({ group: shareGroups, sub: userSubscriptions, service: services })
    .from(shareGroups)
    .innerJoin(userSubscriptions, eq(shareGroups.userSubscriptionId, userSubscriptions.id))
    .leftJoin(plans, eq(userSubscriptions.planId, plans.id))
    .leftJoin(services, eq(plans.serviceId, services.id))
    .where(and(eq(shareGroups.id, groupId), eq(shareGroups.ownerId, ownerId)))
    .limit(1);
  if (!row) throw notFound();
  return row;
}

/** สมาชิกทั้งหมดของกลุ่มพร้อมสถานะของรอบเดือนที่ขอ */
async function membersWithStatus(groupIds: number[], period: string) {
  if (groupIds.length === 0) return [];
  return db
    .select({ member: groupMembers, payment: memberPayments })
    .from(groupMembers)
    .leftJoin(
      memberPayments,
      and(eq(memberPayments.memberId, groupMembers.id), eq(memberPayments.period, period)),
    )
    .where(inArray(groupMembers.groupId, groupIds))
    .orderBy(groupMembers.id);
}

/** กลุ่มเดียวแบบละเอียดสำหรับหน้าเจ้าของ */
export async function getGroup(
  ownerId: number,
  groupId: number,
  period = currentPeriod(),
): Promise<GroupDetailDto> {
  const { group, sub, service } = await loadGroup(ownerId, groupId);
  const rows = await membersWithStatus([groupId], period);
  const total = toSatang(sub.price);
  const members: GroupMemberDto[] = rows.map(({ member, payment }) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    amount: fromSatang(toSatang(member.amount)),
    payUrl: `${env.APP_URL}/pay/${member.payToken}`,
    status: payment?.status ?? "unpaid",
    paidAt: payment?.paidAt?.toISOString() ?? null,
    remindedAt: payment?.remindedAt?.toISOString() ?? null,
  }));
  const membersSum = rows.reduce((s, r) => s + toSatang(r.member.amount), 0);
  return {
    id: group.id,
    name: group.name,
    subscription: {
      id: sub.id,
      name: service?.name ?? sub.customName ?? "",
      logoUrl: service?.logoUrl ?? null,
    },
    total: fromSatang(total),
    memberCount: members.length,
    paidCount: members.filter((m) => m.status === "paid").length,
    period,
    promptpayIdMasked: maskPromptpayId(group.promptpayId),
    splitMode: group.splitMode,
    ownerAmount: fromSatang(total - membersSum),
    members,
  };
}

/** ทุกกลุ่มของเจ้าของ (สรุป) */
export async function listGroups(ownerId: number, period = currentPeriod()): Promise<GroupSummaryDto[]> {
  const groups = await db
    .select({ group: shareGroups, sub: userSubscriptions, service: services })
    .from(shareGroups)
    .innerJoin(userSubscriptions, eq(shareGroups.userSubscriptionId, userSubscriptions.id))
    .leftJoin(plans, eq(userSubscriptions.planId, plans.id))
    .leftJoin(services, eq(plans.serviceId, services.id))
    .where(eq(shareGroups.ownerId, ownerId))
    .orderBy(desc(shareGroups.createdAt));
  const rows = await membersWithStatus(
    groups.map((g) => g.group.id),
    period,
  );
  return groups.map(({ group, sub, service }) => {
    const mine = rows.filter((r) => r.member.groupId === group.id);
    return {
      id: group.id,
      name: group.name,
      subscription: {
        id: sub.id,
        name: service?.name ?? sub.customName ?? "",
        logoUrl: service?.logoUrl ?? null,
      },
      total: fromSatang(toSatang(sub.price)),
      memberCount: mine.length,
      paidCount: mine.filter((r) => r.payment?.status === "paid").length,
      period,
    };
  });
}

/** PromptPay ID ล่าสุดที่ผู้ใช้เคยใช้ (prefill ฟอร์ม) — คืนแบบเต็มเฉพาะให้เจ้าของเอง */
export async function lastPromptpayId(ownerId: number): Promise<string | null> {
  const [row] = await db
    .select({ id: shareGroups.promptpayId })
    .from(shareGroups)
    .where(eq(shareGroups.ownerId, ownerId))
    .orderBy(desc(shareGroups.createdAt))
    .limit(1);
  return row?.id ?? null;
}

/** คำนวณยอดของสมาชิกแต่ละคน (สตางค์) ตามโหมดการหาร */
function memberAmounts(
  totalSatang: number,
  mode: "equal" | "custom",
  members: Pick<MemberInput, "amount">[],
) {
  if (mode === "equal") return members.map(() => splitEqual(totalSatang, members.length).member);
  const amounts = members.map((m, i) => {
    if (m.amount === undefined) {
      throw new ApiError(400, "VALIDATION_ERROR", "โหมดกำหนดเองต้องใส่ยอดของทุกคน", {
        [`members.${i}.amount`]: "กรุณากรอกยอด",
      });
    }
    return toSatang(m.amount);
  });
  const problem = validateCustomSplit(totalSatang, amounts);
  if (problem) throw new ApiError(400, "VALIDATION_ERROR", problem, { members: problem });
  return amounts;
}

/** คำนวณยอดใหม่ทั้งกลุ่มเมื่อเป็นโหมดหารเท่ากัน (หลังเพิ่ม/ลบสมาชิก) */
async function rebalance(groupId: number, totalSatang: number) {
  const members = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  if (members.length === 0) return;
  const share = satangToDecimal(splitEqual(totalSatang, members.length).member);
  await db.update(groupMembers).set({ amount: share }).where(eq(groupMembers.groupId, groupId));
}

/** สร้างกลุ่มหาร (US-F1) — 1 รายการมีได้ 1 กลุ่ม, หารได้เฉพาะรายการรายเดือนที่ใช้งานอยู่ */
export async function createGroup(ownerId: number, input: GroupCreate): Promise<GroupDetailDto> {
  const [row] = await db
    .select({ sub: userSubscriptions, serviceName: services.name })
    .from(userSubscriptions)
    .leftJoin(plans, eq(userSubscriptions.planId, plans.id))
    .leftJoin(services, eq(plans.serviceId, services.id))
    .where(and(eq(userSubscriptions.id, input.subscriptionId), eq(userSubscriptions.userId, ownerId)))
    .limit(1);
  if (!row) throw new ApiError(404, "NOT_FOUND", "ไม่พบรายการนี้");
  if (row.sub.status !== "active")
    throw new ApiError(400, "VALIDATION_ERROR", "รายการนี้ยกเลิกแล้ว หารไม่ได้");
  if (row.sub.billingCycle !== "monthly") {
    throw new ApiError(400, "VALIDATION_ERROR", "ตอนนี้หารได้เฉพาะรายการรายเดือน", {
      subscriptionId: "ตอนนี้หารได้เฉพาะรายการรายเดือน",
    });
  }
  const total = toSatang(row.sub.price);
  const amounts = memberAmounts(total, input.splitMode, input.members);

  let groupId: number;
  try {
    groupId = await db.transaction(async (tx) => {
      const [{ id }] = await tx
        .insert(shareGroups)
        .values({
          ownerId,
          userSubscriptionId: row.sub.id,
          name: input.name || `หาร ${row.serviceName ?? row.sub.customName}`,
          promptpayId: input.promptpayId,
          splitMode: input.splitMode,
        })
        .$returningId();
      await tx.insert(groupMembers).values(
        input.members.map((m, i) => ({
          groupId: id,
          name: m.name,
          email: m.email ?? null,
          amount: satangToDecimal(amounts[i]),
          payToken: newToken(),
        })),
      );
      return id;
    });
  } catch (err) {
    if (isDuplicateKey(err)) throw new ApiError(409, "GROUP_EXISTS", "รายการนี้มีกลุ่มหารอยู่แล้ว");
    throw err;
  }
  return getGroup(ownerId, groupId);
}

/** แก้ชื่อ / PromptPay ID / โหมดการหาร — เปลี่ยนเป็นหารเท่ากันแล้วคำนวณยอดใหม่ทุกคน */
export async function updateGroup(
  ownerId: number,
  groupId: number,
  input: { name?: string; promptpayId?: string; splitMode?: "equal" | "custom" },
) {
  const { sub } = await loadGroup(ownerId, groupId);
  if (Object.keys(input).length > 0) {
    await db
      .update(shareGroups)
      .set(input)
      .where(and(eq(shareGroups.id, groupId), eq(shareGroups.ownerId, ownerId)));
  }
  if (input.splitMode === "equal") await rebalance(groupId, toSatang(sub.price));
  return getGroup(ownerId, groupId);
}

/** ลบกลุ่ม (สมาชิก ลิงก์จ่ายเงิน และสถานะการจ่ายถูกลบตาม) */
export async function deleteGroup(ownerId: number, groupId: number) {
  await loadGroup(ownerId, groupId);
  await db.delete(shareGroups).where(and(eq(shareGroups.id, groupId), eq(shareGroups.ownerId, ownerId)));
}

/** เพิ่มสมาชิก */
export async function addMember(ownerId: number, groupId: number, input: MemberInput) {
  const { group, sub } = await loadGroup(ownerId, groupId);
  const total = toSatang(sub.price);
  const existing = await db.select().from(groupMembers).where(eq(groupMembers.groupId, groupId));
  if (existing.length >= 10) throw new ApiError(400, "VALIDATION_ERROR", "สมาชิกได้ไม่เกิน 10 คน");
  let amount = 0;
  if (group.splitMode === "custom") {
    if (input.amount === undefined) {
      throw new ApiError(400, "VALIDATION_ERROR", "กรุณากรอกยอดของสมาชิก", { amount: "กรุณากรอกยอด" });
    }
    amount = toSatang(input.amount);
    const problem = validateCustomSplit(total, [...existing.map((m) => toSatang(m.amount)), amount]);
    if (problem) throw new ApiError(400, "VALIDATION_ERROR", problem, { amount: problem });
  }
  await db.insert(groupMembers).values({
    groupId,
    name: input.name,
    email: input.email ?? null,
    amount: satangToDecimal(amount),
    payToken: newToken(),
  });
  if (group.splitMode === "equal") await rebalance(groupId, total);
  return getGroup(ownerId, groupId);
}

/** แก้ชื่อ/อีเมล/ยอดของสมาชิก (ยอดแก้ได้เฉพาะโหมดกำหนดเอง) */
export async function updateMember(
  ownerId: number,
  groupId: number,
  memberId: number,
  input: Partial<MemberInput>,
) {
  const { group, sub } = await loadGroup(ownerId, groupId);
  const members = await db.select().from(groupMembers).where(eq(groupMembers.groupId, groupId));
  if (!members.some((m) => m.id === memberId)) throw new ApiError(404, "NOT_FOUND", "ไม่พบสมาชิกนี้");
  const { amount, ...rest } = input;
  let amountDecimal: string | undefined;
  if (amount !== undefined) {
    if (group.splitMode === "equal") {
      throw new ApiError(400, "VALIDATION_ERROR", "โหมดหารเท่ากันแก้ยอดรายคนไม่ได้ เปลี่ยนเป็นกำหนดเองก่อน");
    }
    const next = members.map((m) => (m.id === memberId ? toSatang(amount) : toSatang(m.amount)));
    const problem = validateCustomSplit(toSatang(sub.price), next);
    if (problem) throw new ApiError(400, "VALIDATION_ERROR", problem, { amount: problem });
    amountDecimal = satangToDecimal(toSatang(amount));
  }
  await db
    .update(groupMembers)
    .set({ ...rest, ...(amountDecimal && { amount: amountDecimal }) })
    .where(and(eq(groupMembers.id, memberId), eq(groupMembers.groupId, groupId)));
  return getGroup(ownerId, groupId);
}

/** ลบสมาชิก — ลิงก์จ่ายเงินเดิมใช้ไม่ได้ทันที */
export async function removeMember(ownerId: number, groupId: number, memberId: number) {
  const { group, sub } = await loadGroup(ownerId, groupId);
  const [result] = await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.id, memberId), eq(groupMembers.groupId, groupId)));
  if (result.affectedRows === 0) throw new ApiError(404, "NOT_FOUND", "ไม่พบสมาชิกนี้");
  if (group.splitMode === "equal") await rebalance(groupId, toSatang(sub.price));
  return getGroup(ownerId, groupId);
}

/** เจ้าของกดจ่ายแล้ว/ยังไม่จ่ายของสมาชิกในรอบเดือน (US-F3) */
export async function setPayment(
  ownerId: number,
  groupId: number,
  input: { memberId: number; period: string; status: "paid" | "unpaid" },
) {
  await loadGroup(ownerId, groupId);
  const [member] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.id, input.memberId), eq(groupMembers.groupId, groupId)))
    .limit(1);
  if (!member) throw new ApiError(404, "NOT_FOUND", "ไม่พบสมาชิกนี้");
  const paidAt = input.status === "paid" ? new Date() : null;
  await db
    .insert(memberPayments)
    .values({ memberId: member.id, period: input.period, status: input.status, paidAt })
    .onDuplicateKeyUpdate({ set: { status: input.status, paidAt } });
  return getGroup(ownerId, groupId, input.period);
}

/** ส่งอีเมลเตือนสมาชิกที่ยังไม่จ่าย (P1) — วันละครั้งต่อคน */
export async function remindMember(ownerId: number, groupId: number, memberId: number) {
  const detail = await getGroup(ownerId, groupId);
  const member = detail.members.find((m) => m.id === memberId);
  if (!member) throw new ApiError(404, "NOT_FOUND", "ไม่พบสมาชิกนี้");
  if (!member.email) throw new ApiError(400, "VALIDATION_ERROR", "สมาชิกคนนี้ไม่มีอีเมล");
  if (member.status === "paid")
    throw new ApiError(400, "VALIDATION_ERROR", `${member.name} จ่ายเดือนนี้แล้ว`);
  if (member.remindedAt && todayInBangkok(new Date(member.remindedAt)) === todayInBangkok()) {
    throw new ApiError(429, "RATE_LIMITED", `วันนี้เตือน ${member.name} ไปแล้ว ลองพรุ่งนี้`);
  }
  const [owner] = await db.select({ name: users.name }).from(users).where(eq(users.id, ownerId)).limit(1);
  const amount = formatBaht(member.amount);
  const subject = `${owner.name} ขอเก็บค่า ${detail.subscription.name} ${amount}`;
  const text = `${subject}\nสแกน QR พร้อมเพย์จ่ายได้ที่ ${member.payUrl}`;
  const html = `<div style="font-family:Tahoma,sans-serif;font-size:15px;line-height:1.7">
<p>${escapeHtml(owner.name)} ขอเก็บค่า ${escapeHtml(detail.subscription.name)} ส่วนของคุณ <b>${amount}</b></p>
<p><a href="${member.payUrl}">เปิดหน้าจ่ายเงินและสแกน QR พร้อมเพย์</a></p></div>`;
  await sendMail({ to: member.email, subject, html, text });
  await db
    .insert(memberPayments)
    .values({ memberId, period: detail.period, status: "unpaid", remindedAt: new Date() })
    .onDuplicateKeyUpdate({ set: { remindedAt: new Date() } });
}

/** ข้อมูลหน้าจ่ายเงิน (public, US-F2) — หาด้วย token เท่านั้น ไม่ส่งข้อมูลสมาชิกคนอื่น */
export async function getPayPage(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const period = currentPeriod();
  const [row] = await db
    .select({
      member: groupMembers,
      group: shareGroups,
      sub: userSubscriptions,
      service: services,
      ownerName: users.name,
      payment: memberPayments,
    })
    .from(groupMembers)
    .innerJoin(shareGroups, eq(groupMembers.groupId, shareGroups.id))
    .innerJoin(userSubscriptions, eq(shareGroups.userSubscriptionId, userSubscriptions.id))
    .innerJoin(users, eq(shareGroups.ownerId, users.id))
    .leftJoin(plans, eq(userSubscriptions.planId, plans.id))
    .leftJoin(services, eq(plans.serviceId, services.id))
    .leftJoin(
      memberPayments,
      and(eq(memberPayments.memberId, groupMembers.id), eq(memberPayments.period, period)),
    )
    .where(eq(groupMembers.payToken, token))
    .limit(1);
  if (!row) return null;
  const amount = fromSatang(toSatang(row.member.amount));
  return {
    memberName: row.member.name,
    ownerName: row.ownerName,
    serviceName: row.service?.name ?? row.sub.customName ?? "",
    amount,
    period,
    periodLabel: formatThaiMonth(period),
    promptpayIdMasked: maskPromptpayId(row.group.promptpayId),
    payload: promptpayPayload(row.group.promptpayId, amount),
    status: row.payment?.status ?? "unpaid",
  };
}
