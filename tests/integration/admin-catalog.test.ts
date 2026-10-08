import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DELETE as delCategory } from "@/app/api/admin/categories/[id]/route";
import { POST as createCategory } from "@/app/api/admin/categories/route";
import { GET as adminDashboard } from "@/app/api/admin/dashboard/route";
import { DELETE as delPlan } from "@/app/api/admin/plans/[id]/route";
import { POST as createPlan } from "@/app/api/admin/services/[id]/plans/route";
import { DELETE as delService, PATCH as patchService } from "@/app/api/admin/services/[id]/route";
import { POST as createService } from "@/app/api/admin/services/route";
import { PATCH as setStatus } from "@/app/api/admin/users/[id]/route";
import { GET as listUsers } from "@/app/api/admin/users/route";
import { GET as me } from "@/app/api/auth/me/route";
import { GET as priceHistory } from "@/app/api/plans/[id]/price-history/route";
import { GET as serviceDetail } from "@/app/api/services/[slug]/route";
import { GET as listServices } from "@/app/api/services/route";
import { db } from "@/db";
import { notifications, services, userSubscriptions } from "@/db/schema";
import { call, makeAdmin, makeCatalog, makeSub, makeUser } from "./helpers";

// B. คลังข้อมูลฝั่งผู้ใช้ + H. Admin (docs/04-test-plan.md)

const id = (n: number) => ({ id: String(n) });

describe("US-B1 / B2 คลังบริการ (public)", () => {
  it("B1-2 / B1-3 ค้นหาไทย/อังกฤษ และกรองหมวด", async () => {
    const netflix = await makeCatalog({ serviceName: "Netflix" });
    await makeCatalog({ serviceName: "ทรูไอดี" });
    const q = async (qs: string) =>
      (await call(listServices, `/api/services?${qs}`)).json.data.map((s: { name: string }) => s.name);
    expect(await q("q=net")).toEqual(["Netflix"]);
    expect(await q(`q=${encodeURIComponent("ทรู")}`)).toEqual(["ทรูไอดี"]);
    expect(await q("q=zzz")).toEqual([]);
    expect(await q(`category=${netflix.categorySlug}`)).toEqual(["Netflix"]);
  });

  it("B1-4 บริการที่ซ่อนไม่โผล่ในรายการ และหน้า detail = 404", async () => {
    const hidden = await makeCatalog({ serviceActive: false, serviceName: "ซ่อนอยู่" });
    expect((await call(listServices, "/api/services")).json.data).toEqual([]);
    const r = await call(serviceDetail, "/x", { params: { slug: hidden.serviceSlug } });
    expect(r.status).toBe(404);
  });

  it("B2-3 cancelSteps ที่มี <script> ถูกเก็บเป็นข้อความ (React escape ตอนแสดง)", async () => {
    const admin = await makeAdmin();
    const c = await makeCatalog();
    await call(patchService, "/x", {
      method: "PATCH",
      as: admin,
      params: id(c.serviceId),
      body: { cancelSteps: "<script>alert(1)</script>\nขั้นที่สอง" },
    });
    const r = await call(serviceDetail, "/x", { params: { slug: c.serviceSlug } });
    expect(JSON.stringify(r.json.data)).toContain("<script>alert(1)</script>");
  });

  it("B2-5 ประวัติราคา: แก้ราคา 2 ครั้ง → 3 จุดเรียงเก่า→ใหม่", async () => {
    const admin = await makeAdmin();
    const c = await makeCatalog();
    const { PATCH } = await import("@/app/api/admin/plans/[id]/route");
    for (const price of [449, 479]) {
      await call(PATCH, "/x", { method: "PATCH", as: admin, params: id(c.monthlyPlanId), body: { price } });
    }
    const r = await call(priceHistory, "/x", { params: id(c.monthlyPlanId) });
    expect(r.json.data.map((p: { price: number }) => p.price)).toEqual([419, 449, 479]);
  });
});

describe("US-H1 / H2 / H3 Admin จัดการคลัง", () => {
  it("H1-1 slug ซ้ำ → 400 ที่ fields.slug · ลบหมวดที่มีบริการ → 409 IN_USE · หมวดว่างลบได้", async () => {
    const admin = await makeAdmin();
    const c = await makeCatalog();
    const dup = await call(createCategory, "/x", {
      method: "POST",
      as: admin,
      body: { name: "ซ้ำ", slug: c.categorySlug },
    });
    expect(dup.status).toBe(400);
    expect(dup.json.error.fields).toHaveProperty("slug");

    const inUse = await call(delCategory, "/x", { method: "DELETE", as: admin, params: id(c.categoryId) });
    expect(inUse.status).toBe(409);
    expect(inUse.json.error.code).toBe("IN_USE");

    const empty = await call(createCategory, "/x", {
      method: "POST",
      as: admin,
      body: { name: "ว่าง", slug: "empty-cat" },
    });
    expect(empty.status).toBe(201);
    expect(
      (await call(delCategory, "/x", { method: "DELETE", as: admin, params: id(empty.json.data.id) })).status,
    ).toBe(204);
  });

  it("H2-1 / H3-1 สร้างบริการ + แพ็กเกจ → ฝั่งผู้ใช้เห็น · ซ่อน → หายจากฝั่งผู้ใช้", async () => {
    const admin = await makeAdmin();
    const c = await makeCatalog();
    const svc = await call(createService, "/x", {
      method: "POST",
      as: admin,
      body: { name: "Disney+", slug: "disney-plus", categoryId: c.categoryId, cancelSteps: "กดยกเลิก" },
    });
    expect(svc.status).toBe(201);
    const plan = await call(createPlan, "/x", {
      method: "POST",
      as: admin,
      params: id(svc.json.data.id),
      body: { name: "Premium", price: 289, billingCycle: "monthly" },
    });
    expect(plan.status).toBe(201);
    expect(
      (await call(serviceDetail, "/x", { params: { slug: "disney-plus" } })).json.data.plans,
    ).toHaveLength(1);

    await call(patchService, "/x", {
      method: "PATCH",
      as: admin,
      params: id(svc.json.data.id),
      body: { isActive: false },
    });
    expect((await call(serviceDetail, "/x", { params: { slug: "disney-plus" } })).status).toBe(404);
  });

  it("H2-2 ลบบริการที่มีผู้ใช้ผูก (แม้ยกเลิกแล้ว) → 409 แนะนำให้ซ่อน และข้อมูลผู้ใช้ไม่หาย", async () => {
    const admin = await makeAdmin();
    const u = await makeUser();
    const c = await makeCatalog();
    const subId = await makeSub(u.id, { planId: c.monthlyPlanId, status: "cancelled" });
    const r = await call(delService, "/x", { method: "DELETE", as: admin, params: id(c.serviceId) });
    expect(r.status).toBe(409);
    expect(r.json.error.message).toContain("ซ่อน");
    expect(await db.select().from(userSubscriptions).where(eq(userSubscriptions.id, subId))).toHaveLength(1);
    expect(await db.select().from(services).where(eq(services.id, c.serviceId))).toHaveLength(1);
  });

  it("ลบแพ็กเกจที่มีผู้ใช้ผูก → 409 ไม่ใช่ 500", async () => {
    const admin = await makeAdmin();
    const u = await makeUser();
    const c = await makeCatalog();
    await makeSub(u.id, { planId: c.monthlyPlanId });
    const r = await call(delPlan, "/x", { method: "DELETE", as: admin, params: id(c.monthlyPlanId) });
    expect(r.status).toBe(409);
  });
});

describe("US-H4 จัดการผู้ใช้", () => {
  it("H4-1 รายชื่อ + ค้นหา + แบ่งหน้า · ไม่มี passwordHash", async () => {
    const admin = await makeAdmin();
    for (let i = 0; i < 21; i++) await makeUser({ name: i === 0 ? "สมหญิง" : `คน ${i}` });
    const page1 = await call(listUsers, "/api/admin/users", { as: admin });
    expect(page1.json.meta).toMatchObject({ page: 1, pageSize: 20, total: 22 });
    expect(page1.json.data).toHaveLength(20);
    expect((await call(listUsers, "/api/admin/users?page=2", { as: admin })).json.data).toHaveLength(2);
    const found = await call(listUsers, `/api/admin/users?q=${encodeURIComponent("สมหญิง")}`, { as: admin });
    expect(found.json.data.map((u: { name: string }) => u.name)).toEqual(["สมหญิง"]);
    const text = JSON.stringify(page1.json);
    expect(text).not.toMatch(/password/i);
    expect(text).not.toContain("$2");
  });

  it("H4-2 ระงับ → ผู้ใช้เรียก API ไม่ได้ทันที · admin ระงับตัวเอง/admin อื่น → 400", async () => {
    const admin = await makeAdmin();
    const other = await makeAdmin();
    const u = await makeUser();
    const r = await call(setStatus, "/x", {
      method: "PATCH",
      as: admin,
      params: id(u.id),
      body: { status: "suspended" },
    });
    expect(r.json.data.status).toBe("suspended");
    expect((await call(me, "/api/auth/me", { as: u })).status).toBe(403);
    for (const target of [admin, other]) {
      const res = await call(setStatus, "/x", {
        method: "PATCH",
        as: admin,
        params: id(target.id),
        body: { status: "suspended" },
      });
      expect(res.status).toBe(400);
    }
  });
});

describe("US-H5 Dashboard Admin", () => {
  it("H5-1 / H5-2 / H5-3 totals, top services, ผู้ใช้ใหม่ 30 จุด, อีเมลเดือนนี้", async () => {
    const admin = await makeAdmin();
    const a = await makeUser();
    const b = await makeUser();
    await makeUser(); // ไม่มีรายการ → ไม่นับในค่าเฉลี่ย
    const c = await makeCatalog({ serviceName: "Netflix" });
    await makeSub(a.id, { planId: c.monthlyPlanId, price: "400.00" });
    await makeSub(b.id, { planId: c.monthlyPlanId, price: "200.00" });
    await makeSub(b.id, { planId: c.yearlyPlanId, price: "1200.00", billingCycle: "yearly" });
    await makeSub(b.id, { planId: c.monthlyPlanId, price: "999.00", status: "cancelled" });
    await db.insert(notifications).values([
      { userId: a.id, type: "test", channel: "email", title: "t", body: "b", status: "sent" },
      { userId: a.id, type: "test", channel: "email", title: "t", body: "b", status: "failed" },
      { userId: a.id, type: "test", channel: "in_app", title: "t", body: "b", status: "sent" },
      {
        userId: a.id,
        type: "test",
        channel: "email",
        title: "t",
        body: "b",
        status: "sent",
        createdAt: new Date("2020-01-15T00:00:00Z"),
      },
    ]);

    const { data } = (await call(adminDashboard, "/api/admin/dashboard", { as: admin })).json;
    // (400 + 200 + 100) / 2 คนที่มีรายการ active
    expect(data.totals).toEqual({
      users: 3,
      activeSubscriptions: 3,
      avgMonthlyPerUser: 350,
      emailsThisMonth: 1,
    });
    expect(data.topServices).toEqual([{ serviceId: c.serviceId, name: "Netflix", count: 3 }]);
    expect(data.newUsersDaily).toHaveLength(30);
    expect(data.newUsersDaily.at(-1).count).toBe(3);
    expect(data.newUsersDaily.reduce((s: number, d: { count: number }) => s + d.count, 0)).toBe(3);
  });
});

describe("ค้นหาด้วย % หรือ _ ไม่กลายเป็น wildcard", () => {
  it("q=% → ไม่พบอะไร (เดิมคืนทุกบริการ)", async () => {
    await makeCatalog({ serviceName: "Netflix" });
    expect((await call(listServices, "/api/services?q=%25")).json.data).toEqual([]);
    expect((await call(listServices, "/api/services?q=_")).json.data).toEqual([]);
    expect((await call(listServices, "/api/services?q=flix")).json.data).toHaveLength(1);
  });
});

describe("Admin เห็นช่องทางเข้าสู่ระบบของผู้ใช้ (ไม่เห็น hash / Google id)", () => {
  it("รหัสผ่าน / Google / ทั้งสอง", async () => {
    const admin = await makeAdmin();
    await makeUser({ name: "รหัสผ่าน" });
    await makeUser({ name: "Google ล้วน", passwordHash: null, googleSub: "sub-1" });
    await makeUser({ name: "ทั้งคู่", googleSub: "sub-2" });
    const r = await call(listUsers, "/api/admin/users", { as: admin });
    const byName = Object.fromEntries(
      r.json.data.map((u: { name: string; loginMethods: string[] }) => [u.name, u.loginMethods]),
    );
    expect(byName).toMatchObject({
      รหัสผ่าน: ["email"],
      "Google ล้วน": ["google"],
      ทั้งคู่: ["email", "google"],
    });
    const text = JSON.stringify(r.json);
    expect(text).not.toContain("sub-1");
    expect(text).not.toMatch(/password/i);
  });
});
