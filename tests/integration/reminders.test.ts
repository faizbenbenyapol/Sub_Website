import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as cronRoute } from "@/app/api/cron/reminders/route";
import { POST as testEmail } from "@/app/api/me/notifications/test/route";
import { db } from "@/db";
import { notifications, userSubscriptions, users } from "@/db/schema";
import { runReminders } from "@/server/services/reminders";
import { call, makeCatalog, makeSub, makeUser } from "./helpers";

// E. การแจ้งเตือน (docs/04-test-plan.md ข้อ 4 E) — ตัวส่งเมลถูกแทนด้วย spy เพื่อนับจำนวนครั้งที่ส่งจริง

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock("@/server/mailer", () => ({ sendMail }));

const TODAY = "2026-10-07";

beforeEach(() => {
  sendMail.mockReset();
  sendMail.mockResolvedValue(undefined);
});

const emailRows = (subId: number) =>
  db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userSubscriptionId, subId), eq(notifications.channel, "email")));

describe("US-E1 อีเมลเตือนก่อนตัดเงิน", () => {
  it("E1-2 ตัดในอีก 3 วัน → อีเมล sent 1 แถว + in_app 1 แถว · อีก 4 วัน → ไม่เตือน", async () => {
    const u = await makeUser();
    const c = await makeCatalog({ serviceName: "Netflix" });
    const due = await makeSub(u.id, {
      planId: c.monthlyPlanId,
      price: "419.00",
      nextBillingDate: "2026-10-10",
    });
    const later = await makeSub(u.id, { categoryId: c.categoryId, nextBillingDate: "2026-10-11" });

    const result = await runReminders(TODAY);
    expect(result).toMatchObject({ sent: 1, failed: 0 });
    const rows = await db.select().from(notifications).where(eq(notifications.userSubscriptionId, due));
    expect(rows.map((r) => `${r.channel}:${r.status}`).sort()).toEqual(["email:sent", "in_app:sent"]);
    expect(await emailRows(later)).toHaveLength(0);

    // E1-6 เนื้ออีเมล: ชื่อบริการ ยอด วันที่แบบไทย ลิงก์วิธียกเลิก
    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe(u.email);
    expect(mail.text).toContain("Netflix");
    expect(mail.text).toContain("419");
    expect(mail.html).toContain(`/services/${c.serviceSlug}#cancel`);
  });

  it("E1-3 รันสองรอบวันเดียวกัน → ส่งครั้งเดียว", async () => {
    const u = await makeUser();
    const c = await makeCatalog();
    await makeSub(u.id, { categoryId: c.categoryId, nextBillingDate: "2026-10-09" });
    await runReminders(TODAY);
    const second = await runReminders(TODAY);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(second).toMatchObject({ sent: 0, skipped: 1 });
  });

  it("E1-4 / E1-8 วันถัดไปไม่ส่งซ้ำรอบเดิม · เครื่องปิดวันที่ควรเตือนพอดี → วันถัดไปยังส่ง · รอบบิลถัดไปส่งใหม่", async () => {
    const u = await makeUser();
    const c = await makeCatalog();
    const id = await makeSub(u.id, { categoryId: c.categoryId, nextBillingDate: "2026-10-10" });

    // ข้ามวันที่ 7 (ควรเตือนวันแรก) ไปรันวันที่ 8 — ยังอยู่ในช่วงจึงส่ง
    expect((await runReminders("2026-10-08")).sent).toBe(1);
    expect((await runReminders("2026-10-09")).sent).toBe(0);

    // เลยวันตัดเงิน → เลื่อนเป็น 10 พ.ย. → ถึงช่วงเตือนรอบใหม่
    const r = await runReminders("2026-11-07");
    expect(r.rolled).toBe(1);
    expect(r.sent).toBe(1);
    const [sub] = await db.select().from(userSubscriptions).where(eq(userSubscriptions.id, id));
    expect(sub.nextBillingDate).toBe("2026-11-10");
    expect((await emailRows(id)).map((n) => n.dueDate).sort()).toEqual(["2026-10-10", "2026-11-10"]);
  });

  it("E1-5 ส่งพลาด → failed attempts=1 → รอบถัดไปสำเร็จ · พลาดครบ 3 ครั้งแล้วหยุดลอง", async () => {
    const u = await makeUser();
    const c = await makeCatalog();
    const ok = await makeSub(u.id, { categoryId: c.categoryId, nextBillingDate: "2026-10-09" });
    vi.spyOn(console, "error").mockImplementation(() => {});

    sendMail.mockRejectedValueOnce(new Error("smtp down"));
    expect((await runReminders(TODAY)).failed).toBe(1);
    expect(await emailRows(ok)).toMatchObject([{ status: "failed", attempts: 1 }]);
    expect((await runReminders(TODAY)).sent).toBe(1);
    expect(await emailRows(ok)).toMatchObject([{ status: "sent", attempts: 2 }]);

    const broken = await makeSub(u.id, { categoryId: c.categoryId, nextBillingDate: "2026-10-08" });
    sendMail.mockRejectedValue(new Error("smtp down"));
    for (let i = 0; i < 4; i++) await runReminders(TODAY);
    expect(await emailRows(broken)).toMatchObject([{ status: "failed", attempts: 3 }]);
  });

  it("E1-1 / U-R2 ปิดแจ้งเตือน หรือผู้ใช้ถูกระงับ → ไม่ส่ง · ตั้ง 1 วัน → อีก 3 วันไม่ส่ง", async () => {
    const off = await makeUser({ notifyEnabled: false });
    const suspended = await makeUser({ status: "suspended" });
    const oneDay = await makeUser({ notifyDaysBefore: 1 });
    const c = await makeCatalog();
    for (const u of [off, suspended, oneDay]) {
      await makeSub(u.id, { categoryId: c.categoryId, nextBillingDate: "2026-10-10" });
    }
    await runReminders(TODAY);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("E2-1 หมดทดลองในอีก 3 วัน → อีเมลชนิด trial_ending แยกจาก billing", async () => {
    const u = await makeUser();
    const c = await makeCatalog();
    const id = await makeSub(u.id, {
      categoryId: c.categoryId,
      nextBillingDate: "2026-10-09",
      trialEndsAt: "2026-10-09",
    });
    expect((await runReminders(TODAY)).sent).toBe(2);
    expect((await emailRows(id)).map((n) => n.type).sort()).toEqual(["billing_reminder", "trial_ending"]);
    const subjects = sendMail.mock.calls.map((c) => c[0].subject as string);
    expect(subjects.some((s) => s.includes("ทดลอง"))).toBe(true);
  });
});

describe("E1-7 POST /api/cron/reminders", () => {
  it("ไม่มี / ผิด secret → 401 · ถูก → ได้ตัวนับ", async () => {
    expect((await call(cronRoute, "/api/cron/reminders", { method: "POST", origin: null })).status).toBe(401);
    const wrong = await call(cronRoute, "/api/cron/reminders", {
      method: "POST",
      origin: null,
      headers: { authorization: "Bearer wrong" },
    });
    expect(wrong.status).toBe(401);
    const good = await call(cronRoute, "/api/cron/reminders", {
      method: "POST",
      origin: null,
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    expect(good.status).toBe(200);
    expect(Object.keys(good.json.data).sort()).toEqual(["failed", "rolled", "sent", "skipped"]);
  });
});

describe("US-E4 ส่งอีเมลทดสอบ", () => {
  it("E4-1 ส่งถึงอีเมลผู้ใช้ บันทึก type=test · E4-2 กดซ้ำใน 1 นาที → 429", async () => {
    const u = await makeUser();
    const r = await call(testEmail, "/api/me/notifications/test", { method: "POST", as: u });
    expect(r.status).toBe(200);
    expect(r.json.data.sentTo).toBe(u.email);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: u.email }));
    const [row] = await db.select().from(notifications).where(eq(notifications.userId, u.id));
    expect(row).toMatchObject({ type: "test", status: "sent", dueDate: null });

    expect((await call(testEmail, "/api/me/notifications/test", { method: "POST", as: u })).status).toBe(429);
  });

  it("SMTP พัง → 500 EMAIL_FAILED พร้อมข้อความบอกวิธีแก้ ไม่มี stack trace", async () => {
    const u = await makeUser();
    vi.spyOn(console, "error").mockImplementation(() => {});
    sendMail.mockRejectedValueOnce(new Error("Invalid login: 535 secret detail"));
    const r = await call(testEmail, "/api/me/notifications/test", { method: "POST", as: u });
    expect(r.status).toBe(500);
    expect(r.json.error.code).toBe("EMAIL_FAILED");
    expect(JSON.stringify(r.json)).not.toContain("secret detail");
  });
});

describe("ผู้ใช้ถูกลบ → แจ้งเตือนหายตาม (cascade)", () => {
  it("ไม่เหลือแถว notifications ค้าง", async () => {
    const u = await makeUser();
    const c = await makeCatalog();
    await makeSub(u.id, { categoryId: c.categoryId, nextBillingDate: "2026-10-09" });
    await runReminders(TODAY);
    await db.delete(users).where(eq(users.id, u.id));
    expect(await db.select().from(notifications)).toHaveLength(0);
  });
});
