import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { PATCH as adminPatchUser, DELETE as adminDeleteUser } from "@/app/api/admin/users/[id]/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { PATCH as changePassword } from "@/app/api/me/password/route";
import { POST as verifyPassword } from "@/app/api/me/password/verify/route";
import { db } from "@/db";
import { users, userSubscriptions } from "@/db/schema";
import { call, makeAdmin, makeCatalog, makeSub, makeUser, PASSWORD } from "./helpers";

// หลังบ้าน: เปลี่ยนสิทธิ์ / ลบบัญชี · ผู้ใช้: ยืนยันรหัสเดิมแล้วเปลี่ยนรหัสผ่าน

const params = (id: number) => ({ params: { id: String(id) } });

describe("หลังบ้าน: เปลี่ยนสิทธิ์ผู้ใช้", () => {
  it("ตั้งผู้ใช้เป็น admin แล้ว token เดิมใช้ไม่ได้ (ต้องล็อกอินใหม่ให้ได้สิทธิ์ใน token) · ถอดกลับได้", async () => {
    const admin = await makeAdmin();
    const u = await makeUser();
    const up = await call(adminPatchUser, "/x", {
      method: "PATCH",
      as: admin,
      body: { role: "admin" },
      ...params(u.id),
    });
    expect(up.status).toBe(200);
    expect(up.json.data.role).toBe("admin");
    expect((await call(me, "/api/auth/me", { as: u })).status).toBe(401);

    const fresh = (await db.select().from(users).where(eq(users.id, u.id)))[0];
    const down = await call(adminPatchUser, "/x", {
      method: "PATCH",
      as: admin,
      body: { role: "user" },
      ...params(fresh.id),
    });
    expect(down.json.data.role).toBe("user");
  });

  it("เปลี่ยนสิทธิ์ตัวเองไม่ได้ · ตั้งบัญชีที่ถูกระงับเป็น admin ไม่ได้ · ส่ง status กับ role พร้อมกันไม่ได้", async () => {
    const admin = await makeAdmin();
    const suspended = await makeUser({ status: "suspended" });
    const self = await call(adminPatchUser, "/x", {
      method: "PATCH",
      as: admin,
      body: { role: "user" },
      ...params(admin.id),
    });
    expect(self.status).toBe(400);
    const promoteSuspended = await call(adminPatchUser, "/x", {
      method: "PATCH",
      as: admin,
      body: { role: "admin" },
      ...params(suspended.id),
    });
    expect(promoteSuspended.status).toBe(400);
    const both = await call(adminPatchUser, "/x", {
      method: "PATCH",
      as: admin,
      body: { role: "admin", status: "active" },
      ...params(suspended.id),
    });
    expect(both.status).toBe(400);
  });
});

describe("หลังบ้าน: ลบบัญชี", () => {
  it("ลบผู้ใช้ → ข้อมูลรายการหายตาม · ลบตัวเอง/ผู้ดูแลระบบไม่ได้ · ไม่พบ → 404", async () => {
    const admin = await makeAdmin();
    const other = await makeAdmin();
    const u = await makeUser();
    const c = await makeCatalog();
    await makeSub(u.id, { planId: c.monthlyPlanId });

    const del = await call(adminDeleteUser, "/x", { method: "DELETE", as: admin, ...params(u.id) });
    expect(del.status).toBe(204);
    expect(await db.select().from(users).where(eq(users.id, u.id))).toHaveLength(0);
    expect(await db.select().from(userSubscriptions).where(eq(userSubscriptions.userId, u.id))).toHaveLength(
      0,
    );

    for (const target of [admin, other]) {
      expect(
        (await call(adminDeleteUser, "/x", { method: "DELETE", as: admin, ...params(target.id) })).status,
      ).toBe(400);
    }
    expect(
      (await call(adminDeleteUser, "/x", { method: "DELETE", as: admin, ...params(999999) })).status,
    ).toBe(404);
  });

  it("ผู้ใช้ทั่วไปลบใครไม่ได้ (403)", async () => {
    const u = await makeUser();
    const victim = await makeUser();
    expect(
      (await call(adminDeleteUser, "/x", { method: "DELETE", as: u, ...params(victim.id) })).status,
    ).toBe(403);
  });
});

describe("เปลี่ยนรหัสผ่านของฉัน", () => {
  it("ยืนยันรหัสเดิม → เปลี่ยน → ล็อกอินด้วยรหัสใหม่ได้ รหัสเดิมไม่ได้ · เครื่องอื่นหลุด เครื่องนี้ได้ cookie ใหม่", async () => {
    const u = await makeUser();
    const wrong = await call(verifyPassword, "/x", {
      method: "POST",
      as: u,
      body: { currentPassword: "ผิด" },
    });
    expect(wrong.status).toBe(400);
    expect(wrong.json.error.fields.currentPassword).toBeDefined();
    expect(
      (await call(verifyPassword, "/x", { method: "POST", as: u, body: { currentPassword: PASSWORD } }))
        .status,
    ).toBe(200);

    const r = await call(changePassword, "/x", {
      method: "PATCH",
      as: u,
      body: { currentPassword: PASSWORD, newPassword: "new-pass-9999", confirmPassword: "new-pass-9999" },
    });
    expect(r.status).toBe(200);
    expect(r.res.headers.get("set-cookie")).toContain("session");
    expect((await call(me, "/api/auth/me", { as: u })).status).toBe(401); // token เดิม (session เก่า) หลุด

    const loginNew = await call(login, "/x", {
      method: "POST",
      body: { email: u.email, password: "new-pass-9999" },
    });
    expect(loginNew.status).toBe(200);
    const loginOld = await call(login, "/x", {
      method: "POST",
      body: { email: u.email, password: PASSWORD },
    });
    expect(loginOld.status).toBe(401);
  });

  it("รหัสเดิมผิดตอนเปลี่ยนจริง → 400 · รหัสใหม่ไม่ตรงกัน/สั้น/ซ้ำของเดิม → 400 ที่ช่องนั้น · ผิดเกิน 5 ครั้ง → 429", async () => {
    const u = await makeUser();
    const change = (body: object) => call(changePassword, "/x", { method: "PATCH", as: u, body });
    const skipVerify = await change({
      currentPassword: "ไม่ใช่รหัส",
      newPassword: "abcdefgh1",
      confirmPassword: "abcdefgh1",
    });
    expect(skipVerify.json.error.fields.currentPassword).toBeDefined();
    const mismatch = await change({
      currentPassword: PASSWORD,
      newPassword: "abcdefgh1",
      confirmPassword: "abcdefgh2",
    });
    expect(mismatch.json.error.fields.confirmPassword).toBeDefined();
    const short = await change({ currentPassword: PASSWORD, newPassword: "short", confirmPassword: "short" });
    expect(short.json.error.fields.newPassword).toBeDefined();
    const same = await change({
      currentPassword: PASSWORD,
      newPassword: PASSWORD,
      confirmPassword: PASSWORD,
    });
    expect(same.json.error.fields.newPassword).toBeDefined();

    const victim = await makeUser();
    for (let i = 0; i < 5; i++) {
      await call(verifyPassword, "/x", { method: "POST", as: victim, body: { currentPassword: `เดา-${i}` } });
    }
    const blocked = await call(verifyPassword, "/x", {
      method: "POST",
      as: victim,
      body: { currentPassword: PASSWORD },
    });
    expect(blocked.status).toBe(429);
  });

  it("บัญชี Google ที่ยังไม่มีรหัส ตั้งรหัสใหม่ได้โดยไม่ต้องมีรหัสเดิม แล้วล็อกอินด้วยอีเมลได้", async () => {
    const g = await makeUser({ passwordHash: null, googleSub: "google-sub-123" });
    const r = await call(changePassword, "/x", {
      method: "PATCH",
      as: g,
      body: { newPassword: "first-pass-1", confirmPassword: "first-pass-1" },
    });
    expect(r.status).toBe(200);
    expect(
      (await call(login, "/x", { method: "POST", body: { email: g.email, password: "first-pass-1" } }))
        .status,
    ).toBe(200);
  });
});
