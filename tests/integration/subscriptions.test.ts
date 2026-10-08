import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { PATCH as updatePlan } from "@/app/api/admin/plans/[id]/route";
import { GET as calendar } from "@/app/api/calendar/route";
import { GET as dashboard } from "@/app/api/dashboard/route";
import { PATCH as updateSettings } from "@/app/api/me/settings/route";
import { POST as markRead } from "@/app/api/notifications/[id]/read/route";
import { POST as readAll } from "@/app/api/notifications/read-all/route";
import { GET as listNotifications } from "@/app/api/notifications/route";
import { DELETE as del, GET as getOne, PATCH as patch } from "@/app/api/subscriptions/[id]/route";
import { GET as list, POST as create } from "@/app/api/subscriptions/route";
import { db } from "@/db";
import { notifications, plans, userSubscriptions } from "@/db/schema";
import { anchorDayOf } from "@/lib/billing";
import { call, daysFromToday, makeAdmin, makeCatalog, makeSub, makeUser } from "./helpers";

// C. Subscription ของผู้ใช้ · D. Dashboard · E3 กระดิ่ง · A3-3/A3-4 ของคนอื่น (docs/04-test-plan.md)

const params = (id: number) => ({ params: { id: String(id) } });

describe("US-C1 เพิ่มรายการ", () => {
  it("C1-1 เพิ่มจากคลัง → price/รอบบิลตามที่ส่ง, anchor = วันของ nextBillingDate", async () => {
    const u = await makeUser();
    const c = await makeCatalog();
    const date = daysFromToday(5);
    const r = await call(create, "/api/subscriptions", {
      method: "POST",
      as: u,
      body: {
        source: "catalog",
        planId: c.monthlyPlanId,
        price: 419,
        billingCycle: "monthly",
        nextBillingDate: date,
      },
    });
    expect(r.status).toBe(201);
    expect(r.json.data).toMatchObject({
      price: 419,
      monthlyCost: 419,
      isCustom: false,
      nextBillingDate: date,
      billingAnchorDay: anchorDayOf(date),
      plan: { id: c.monthlyPlanId },
    });
  });

  it("C1-2 เพิ่มเองต้องมี customName + customCategoryId", async () => {
    const u = await makeUser();
    const c = await makeCatalog();
    const base = { source: "custom", price: 59, billingCycle: "monthly", nextBillingDate: daysFromToday(1) };
    const missing = await call(create, "/api/subscriptions", { method: "POST", as: u, body: base });
    expect(missing.status).toBe(400);
    expect(missing.json.error.fields).toHaveProperty("customName");
    expect(missing.json.error.fields).toHaveProperty("customCategoryId");

    const okRes = await call(create, "/api/subscriptions", {
      method: "POST",
      as: u,
      body: { ...base, customName: "ฟิตเนส", customCategoryId: c.categoryId },
    });
    expect(okRes.status).toBe(201);
    expect(okRes.json.data).toMatchObject({ name: "ฟิตเนส", isCustom: true, category: { id: c.categoryId } });
  });

  it("C1-3 / U-V1 ราคาติดลบ, ไม่มีวันตัดเงิน, วันในอดีต → 400 ที่ช่องนั้น", async () => {
    const u = await makeUser();
    const c = await makeCatalog();
    const body = { source: "catalog", planId: c.monthlyPlanId, billingCycle: "monthly" };
    const negative = await call(create, "/api/subscriptions", {
      method: "POST",
      as: u,
      body: { ...body, price: -1, nextBillingDate: daysFromToday(1) },
    });
    expect(negative.json.error.fields).toHaveProperty("price");
    const noDate = await call(create, "/api/subscriptions", {
      method: "POST",
      as: u,
      body: { ...body, price: 1 },
    });
    expect(noDate.json.error.fields).toHaveProperty("nextBillingDate");
    const past = await call(create, "/api/subscriptions", {
      method: "POST",
      as: u,
      body: { ...body, price: 1, nextBillingDate: daysFromToday(-1) },
    });
    expect(past.status).toBe(400);
    expect(past.json.error.fields).toHaveProperty("nextBillingDate");
  });

  it("C1-4 planId ที่ไม่มี หรือบริการถูกซ่อน → 404", async () => {
    const u = await makeUser();
    const hidden = await makeCatalog({ serviceActive: false });
    const body = { source: "catalog", price: 1, billingCycle: "monthly", nextBillingDate: daysFromToday(1) };
    for (const planId of [999_999, hidden.monthlyPlanId]) {
      const r = await call(create, "/api/subscriptions", {
        method: "POST",
        as: u,
        body: { ...body, planId },
      });
      expect(r.status, `planId ${planId}`).toBe(404);
    }
  });
});

describe("US-C2 แก้ / ยกเลิก / ลบ", () => {
  it("C2-1 แก้วันตัดเงิน → anchor อัปเดตตาม", async () => {
    const u = await makeUser();
    const c = await makeCatalog();
    const id = await makeSub(u.id, { categoryId: c.categoryId });
    const date = daysFromToday(20);
    const r = await call(patch, `/api/subscriptions/${id}`, {
      method: "PATCH",
      as: u,
      body: { price: 99.5, nextBillingDate: date },
      ...params(id),
    });
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({
      price: 99.5,
      nextBillingDate: date,
      billingAnchorDay: anchorDayOf(date),
    });
  });

  it("C2-2 ยกเลิก → cancelled + cancelledAt, อยู่ในแท็บยกเลิกแล้ว, ไม่นับในยอดรวม", async () => {
    const u = await makeUser();
    const c = await makeCatalog();
    const keep = await makeSub(u.id, { categoryId: c.categoryId, price: "100.00" });
    const cancel = await makeSub(u.id, { categoryId: c.categoryId, price: "50.00" });
    const r = await call(patch, `/api/subscriptions/${cancel}`, {
      method: "PATCH",
      as: u,
      body: { status: "cancelled" },
      ...params(cancel),
    });
    expect(r.json.data.status).toBe("cancelled");
    expect(r.json.data.cancelledAt).not.toBeNull();

    const active = await call(list, "/api/subscriptions", { as: u });
    const cancelled = await call(list, "/api/subscriptions?status=cancelled", { as: u });
    expect(active.json.data.map((s: { id: number }) => s.id)).toEqual([keep]);
    expect(cancelled.json.data.map((s: { id: number }) => s.id)).toEqual([cancel]);
    expect((await call(dashboard, "/api/dashboard", { as: u })).json.data.totals.monthly).toBe(100);
  });

  it("C2-3 ลบแล้ว → GET 404", async () => {
    const u = await makeUser();
    const c = await makeCatalog();
    const id = await makeSub(u.id, { categoryId: c.categoryId });
    expect(
      (await call(del, `/api/subscriptions/${id}`, { method: "DELETE", as: u, ...params(id) })).status,
    ).toBe(204);
    expect((await call(getOne, `/api/subscriptions/${id}`, { as: u, ...params(id) })).status).toBe(404);
  });

  it("C2-5 / ADR-005 Admin แก้ราคาแพ็กเกจ → ราคาของผู้ใช้ไม่เปลี่ยน แต่ catalogPrice เปลี่ยน", async () => {
    const u = await makeUser();
    const admin = await makeAdmin();
    const c = await makeCatalog();
    const id = await makeSub(u.id, { planId: c.monthlyPlanId, price: "419.00" });
    const r = await call(updatePlan, `/api/admin/plans/${c.monthlyPlanId}`, {
      method: "PATCH",
      as: admin,
      body: { price: 459 },
      ...params(c.monthlyPlanId),
    });
    expect(r.status).toBe(200);
    const sub = await call(getOne, `/api/subscriptions/${id}`, { as: u, ...params(id) });
    expect(sub.json.data).toMatchObject({ price: 419, catalogPrice: 459 });
  });

  it("?status ผิดค่า → 400", async () => {
    const u = await makeUser();
    expect((await call(list, "/api/subscriptions?status=deleted", { as: u })).status).toBe(400);
  });
});

describe("A3-3 รายการของคนอื่น → 404 และข้อมูลไม่เปลี่ยน", () => {
  it("GET / PATCH / DELETE", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const c = await makeCatalog();
    const id = await makeSub(b.id, { categoryId: c.categoryId, price: "100.00" });
    expect((await call(getOne, `/api/subscriptions/${id}`, { as: a, ...params(id) })).status).toBe(404);
    expect(
      (
        await call(patch, `/api/subscriptions/${id}`, {
          method: "PATCH",
          as: a,
          body: { price: 1 },
          ...params(id),
        })
      ).status,
    ).toBe(404);
    expect(
      (await call(del, `/api/subscriptions/${id}`, { method: "DELETE", as: a, ...params(id) })).status,
    ).toBe(404);
    const [row] = await db.select().from(userSubscriptions).where(eq(userSubscriptions.id, id));
    expect(row.price).toBe("100.00");
    expect((await call(list, "/api/subscriptions", { as: a })).json.data).toEqual([]);
  });

  it("id ไม่ใช่ตัวเลข → 404 (ไม่ใช่ 500)", async () => {
    const u = await makeUser();
    expect((await call(getOne, "/api/subscriptions/abc", { as: u, params: { id: "abc" } })).status).toBe(404);
  });
});

describe("US-D1 Dashboard", () => {
  it("D1-1 / D1-2 รายเดือน 419 + 149, รายปี 1,290 → 675.50/เดือน 8,106/ปี และสัดส่วนหมวดรวมเท่ายอด", async () => {
    const u = await makeUser();
    const c1 = await makeCatalog();
    const c2 = await makeCatalog();
    await makeSub(u.id, { categoryId: c1.categoryId, price: "419.00" });
    await makeSub(u.id, { categoryId: c1.categoryId, price: "149.00" });
    await makeSub(u.id, { categoryId: c2.categoryId, price: "1290.00", billingCycle: "yearly" });
    await makeSub(u.id, { categoryId: c2.categoryId, price: "999.00", status: "cancelled" });

    const { data } = (await call(dashboard, "/api/dashboard", { as: u })).json;
    expect(data.totals).toEqual({ monthly: 675.5, yearly: 8106, activeCount: 3 });
    expect(data.byCategory.map((x: { monthly: number }) => x.monthly)).toEqual([568, 107.5]);
  });

  it("D1-3 upcoming: วันนี้ถึงอีก 7 วัน เรียงตามวัน รวมวันหมดทดลอง", async () => {
    const u = await makeUser();
    const c = await makeCatalog();
    await makeSub(u.id, { categoryId: c.categoryId, customName: "C", nextBillingDate: daysFromToday(7) });
    await makeSub(u.id, { categoryId: c.categoryId, customName: "A", nextBillingDate: daysFromToday(0) });
    await makeSub(u.id, { categoryId: c.categoryId, customName: "ไกล", nextBillingDate: daysFromToday(8) });
    await makeSub(u.id, {
      categoryId: c.categoryId,
      customName: "B",
      nextBillingDate: daysFromToday(20),
      trialEndsAt: daysFromToday(3),
    });
    const { upcoming } = (await call(dashboard, "/api/dashboard", { as: u })).json.data;
    expect(upcoming.map((x: { name: string; kind: string }) => `${x.name}:${x.kind}`)).toEqual([
      "A:billing",
      "B:trial_end",
      "C:billing",
    ]);
  });

  it("D2-3 ปฏิทิน ?month=2026-13 → 400 · เดือนที่ถูกต้อง → 200", async () => {
    const u = await makeUser();
    expect((await call(calendar, "/api/calendar?month=2026-13", { as: u })).status).toBe(400);
    const r = await call(calendar, `/api/calendar?month=${daysFromToday(0).slice(0, 7)}`, { as: u });
    expect(r.status).toBe(200);
  });
});

describe("US-E1 ตั้งค่า / US-E3 กระดิ่ง", () => {
  it("U-V3 notifyDaysBefore: 5 → 400 · 7 → บันทึก", async () => {
    const u = await makeUser();
    const bad = await call(updateSettings, "/api/me/settings", {
      method: "PATCH",
      as: u,
      body: { notifyDaysBefore: 5 },
    });
    expect(bad.status).toBe(400);
    const good = await call(updateSettings, "/api/me/settings", {
      method: "PATCH",
      as: u,
      body: { notifyDaysBefore: 7, notifyEnabled: false },
    });
    expect(good.json.data).toMatchObject({ notifyDaysBefore: 7, notifyEnabled: false });
  });

  it("E3-1 จำนวนยังไม่อ่าน → อ่าน 1 → ลดลง · อ่านทั้งหมด → 0 · A3-4 อ่านของคนอื่น → 404", async () => {
    const u = await makeUser();
    const other = await makeUser();
    const mk = (userId: number, title: string) =>
      db
        .insert(notifications)
        .values({ userId, type: "test", channel: "in_app", title, body: "-", status: "sent" })
        .$returningId();
    const [{ id: first }] = await mk(u.id, "หนึ่ง");
    await mk(u.id, "สอง");
    const [{ id: othersId }] = await mk(other.id, "ของคนอื่น");

    const unread = async () =>
      (await call(listNotifications, "/api/notifications", { as: u })).json.meta.unreadCount;
    expect(await unread()).toBe(2);
    expect((await call(markRead, "/x", { method: "POST", as: u, ...params(first) })).status).toBe(204);
    expect(await unread()).toBe(1);
    expect((await call(markRead, "/x", { method: "POST", as: u, ...params(othersId) })).status).toBe(404);
    await call(readAll, "/api/notifications/read-all", { method: "POST", as: u });
    expect(await unread()).toBe(0);
    const [others] = await db.select().from(notifications).where(eq(notifications.id, othersId));
    expect(others.readAt).toBeNull();
  });
});

describe("H3-2 ประวัติราคา (ทางเดียวกับ C2-5)", () => {
  it("แก้ราคา → price_history 1 แถว · แก้ชื่ออย่างเดียว → ไม่มีแถวใหม่", async () => {
    const admin = await makeAdmin();
    const c = await makeCatalog();
    const p = { ...params(c.monthlyPlanId), method: "PATCH" as const, as: admin };
    await call(updatePlan, "/x", { ...p, body: { price: 459 } });
    await call(updatePlan, "/x", { ...p, body: { name: "รายเดือนใหม่" } });
    const { priceHistory } = await import("@/db/schema");
    const rows = await db.select().from(priceHistory).where(eq(priceHistory.planId, c.monthlyPlanId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ oldPrice: "419.00", newPrice: "459.00", changedBy: admin.id });
    const [plan] = await db.select().from(plans).where(eq(plans.id, c.monthlyPlanId));
    expect(plan.name).toBe("รายเดือนใหม่");
  });
});
