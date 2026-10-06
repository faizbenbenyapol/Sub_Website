import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, plans, services, userSubscriptions, users } from "@/db/schema";
import { rollForward } from "@/lib/billing";
import { reminderEmail } from "@/lib/email-templates";
import { todayInBangkok } from "@/lib/dates";
import { decimalToNumber } from "@/lib/money";
import { withinReminderWindow } from "@/lib/schedule";
import { env } from "../env";
import { sendMail } from "../mailer";

// งานแจ้งเตือนรายวัน (docs/02 ข้อ 6, US-E1, E2) — เรียกจาก POST /api/cron/reminders เท่านั้น
// ตั้งใจไม่ scope ด้วย user เพราะทำงานแทนระบบกับผู้ใช้ทุกคน

const MAX_ATTEMPTS = 3;
let running = false; // กันรันซ้อนเมื่อ cron กับการกดสั่งเองชนกัน

export type ReminderRunResult = { rolled: number; sent: number; skipped: number; failed: number };

/** เลื่อนวันตัดเงินของรายการ active ที่เลยวันมาแล้ว (US-C2) */
async function rollOverdue(today: string): Promise<number> {
  const overdue = await db
    .select()
    .from(userSubscriptions)
    .where(and(eq(userSubscriptions.status, "active"), lt(userSubscriptions.nextBillingDate, today)));
  for (const s of overdue) {
    const next = rollForward(s.nextBillingDate, s.billingCycle, s.billingAnchorDay, today);
    await db.update(userSubscriptions).set({ nextBillingDate: next }).where(eq(userSubscriptions.id, s.id));
  }
  return overdue.length;
}

/** รายการที่อาจต้องเตือน: ผู้ใช้ใช้งานได้ + เปิดแจ้งเตือน + รายการยังใช้อยู่ */
function loadCandidates() {
  return db
    .select({
      subscriptionId: userSubscriptions.id,
      userId: users.id,
      email: users.email,
      daysBefore: users.notifyDaysBefore,
      price: userSubscriptions.price,
      nextBillingDate: userSubscriptions.nextBillingDate,
      trialEndsAt: userSubscriptions.trialEndsAt,
      customName: userSubscriptions.customName,
      serviceName: services.name,
      serviceSlug: services.slug,
    })
    .from(userSubscriptions)
    .innerJoin(users, eq(userSubscriptions.userId, users.id))
    .leftJoin(plans, eq(userSubscriptions.planId, plans.id))
    .leftJoin(services, eq(plans.serviceId, services.id))
    .where(
      and(eq(userSubscriptions.status, "active"), eq(users.status, "active"), eq(users.notifyEnabled, true)),
    );
}

type Candidate = Awaited<ReturnType<typeof loadCandidates>>[number];
type Due = { c: Candidate; type: "billing_reminder" | "trial_ending"; dueDate: string };

/** เลือกว่ารายการไหนถึงช่วงเตือนวันนี้ (U-R1, R2 ทดสอบผ่าน withinReminderWindow) */
function pickDue(candidates: Candidate[], today: string): Due[] {
  const due: Due[] = [];
  for (const c of candidates) {
    if (withinReminderWindow(today, c.nextBillingDate, c.daysBefore)) {
      due.push({ c, type: "billing_reminder", dueDate: c.nextBillingDate });
    }
    if (c.trialEndsAt && withinReminderWindow(today, c.trialEndsAt, c.daysBefore)) {
      due.push({ c, type: "trial_ending", dueDate: c.trialEndsAt });
    }
  }
  return due;
}

/**
 * ส่งหนึ่งการแจ้งเตือนแบบกันซ้ำ: จองแถวด้วย unique key (รายการ, ชนิด, รอบบิล, ช่องทาง) ก่อนส่ง
 * ส่งแล้ว = ข้าม, พลาด = นับ attempts แล้วรอบถัดไปลองใหม่จนครบ MAX_ATTEMPTS
 */
async function deliver({ c, type, dueDate }: Due, today: string): Promise<"sent" | "skipped" | "failed"> {
  const path = c.serviceSlug
    ? `/services/${c.serviceSlug}#cancel`
    : `/subscriptions/${c.subscriptionId}/edit`;
  const mail = reminderEmail({
    kind: type === "trial_ending" ? "trial_end" : "billing",
    serviceName: c.serviceName ?? c.customName ?? "",
    amount: decimalToNumber(c.price),
    date: dueDate,
    today,
    manageUrl: `${env.APP_URL}${path}`,
    settingsUrl: `${env.APP_URL}/settings`,
  });
  const key = { userId: c.userId, userSubscriptionId: c.subscriptionId, type, dueDate };
  const match = and(
    eq(notifications.userSubscriptionId, c.subscriptionId),
    eq(notifications.type, type),
    eq(notifications.dueDate, dueDate),
    eq(notifications.channel, "email"),
  );

  await db
    .insert(notifications)
    .values({ ...key, channel: "email", title: mail.title, body: mail.body, link: path, status: "pending" })
    .onDuplicateKeyUpdate({ set: { id: sql`id` } });
  const [row] = await db.select().from(notifications).where(match).limit(1);
  if (!row || row.status === "sent" || row.attempts >= MAX_ATTEMPTS) return "skipped";

  try {
    await sendMail({ to: c.email, subject: mail.subject, html: mail.html, text: mail.text });
  } catch (err) {
    console.error(`[reminders] ส่งถึง user ${c.userId} ไม่สำเร็จ`, err);
    await db
      .update(notifications)
      .set({ status: "failed", attempts: sql`${notifications.attempts} + 1` })
      .where(eq(notifications.id, row.id));
    return "failed";
  }

  await db
    .update(notifications)
    .set({ status: "sent", attempts: sql`${notifications.attempts} + 1` })
    .where(eq(notifications.id, row.id));
  // แถวสำหรับกระดิ่งในเว็บ (US-E3) — unique key เดียวกันจึงไม่ซ้ำ
  await db
    .insert(notifications)
    .values({ ...key, channel: "in_app", title: mail.title, body: mail.body, link: path, status: "sent" })
    .onDuplicateKeyUpdate({ set: { id: sql`id` } });
  return "sent";
}

/** งานรายวัน: เลื่อนวันตัดเงิน → หารายการที่ถึงช่วงเตือน → ส่งอีเมลแบบกันซ้ำ */
export async function runReminders(today = todayInBangkok()): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { rolled: 0, sent: 0, skipped: 0, failed: 0 };
  if (running) return result;
  running = true;
  try {
    result.rolled = await rollOverdue(today);
    for (const due of pickDue(await loadCandidates(), today)) {
      result[await deliver(due, today)]++;
    }
    console.info(`[reminders] ${today}`, result);
    return result;
  } finally {
    running = false;
  }
}
