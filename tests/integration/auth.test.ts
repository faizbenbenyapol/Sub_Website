import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { eq } from "drizzle-orm";
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as register } from "@/app/api/auth/register/route";
import { db } from "@/db";
import { users } from "@/db/schema";
import { call, makeAdmin, makeUser, PASSWORD } from "./helpers";

// A. Authentication + US-A3 (docs/04-test-plan.md ข้อ 4)

const registerBody = (over: Record<string, unknown> = {}) => ({
  name: "มายด์",
  email: "mind@test.local",
  password: "password-123",
  ...over,
});

describe("US-A1 สมัครสมาชิก", () => {
  it("A1-1 ข้อมูลครบ → 201, role user, ได้ cookie httpOnly", async () => {
    const r = await call(register, "/api/auth/register", { method: "POST", body: registerBody() });
    expect(r.status).toBe(201);
    expect(r.json.data).toMatchObject({ name: "มายด์", email: "mind@test.local", role: "user" });
    const cookie = r.res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^session=/);
    expect(cookie.toLowerCase()).toContain("httponly");
  });

  it("A1-2 อีเมลซ้ำต่างตัวพิมพ์ → 409 EMAIL_TAKEN", async () => {
    await call(register, "/api/auth/register", { method: "POST", body: registerBody({ email: "A@x.com" }) });
    const r = await call(register, "/api/auth/register", {
      method: "POST",
      body: registerBody({ email: "a@x.com" }),
    });
    expect(r.status).toBe(409);
    expect(r.json.error).toMatchObject({ code: "EMAIL_TAKEN", message: "อีเมลนี้ถูกใช้แล้ว" });
  });

  it("A1-3 รหัสใน DB เป็น bcrypt ไม่ใช่ข้อความเดิม", async () => {
    await call(register, "/api/auth/register", { method: "POST", body: registerBody() });
    const [u] = await db.select().from(users).where(eq(users.email, "mind@test.local"));
    expect(u.passwordHash).toMatch(/^\$2/);
    expect(u.passwordHash).not.toContain("password-123");
  });

  it("A1-4 ส่ง role: admin มา → ยังได้ role user", async () => {
    const r = await call(register, "/api/auth/register", {
      method: "POST",
      body: registerBody({ role: "admin" }),
    });
    expect(r.json.data.role).toBe("user");
  });

  it("U-V2 รหัส 7 ตัว + อีเมลผิดรูป → 400 พร้อม fields ตรงช่อง", async () => {
    const r = await call(register, "/api/auth/register", {
      method: "POST",
      body: registerBody({ email: "not-email", password: "1234567" }),
    });
    expect(r.status).toBe(400);
    expect(Object.keys(r.json.error.fields).sort()).toEqual(["email", "password"]);
  });
});

describe("US-A2 เข้าสู่ระบบ / ออกจากระบบ", () => {
  it("ล็อกอินสำเร็จ → 200 + cookie และ response ไม่มี passwordHash", async () => {
    const u = await makeUser();
    const r = await call(login, "/api/auth/login", {
      method: "POST",
      body: { email: u.email, password: PASSWORD },
    });
    expect(r.status).toBe(200);
    expect(r.res.headers.get("set-cookie")).toMatch(/^session=/);
    expect(JSON.stringify(r.json)).not.toContain("passwordHash");
  });

  it("A2-1 อีเมลผิดกับรหัสผิด → 401 ข้อความเหมือนกันทุกตัวอักษร", async () => {
    const u = await makeUser();
    const wrongPass = await call(login, "/api/auth/login", {
      method: "POST",
      body: { email: u.email, password: "wrong-pass" },
    });
    const wrongEmail = await call(login, "/api/auth/login", {
      method: "POST",
      body: { email: "nobody@test.local", password: PASSWORD },
    });
    expect(wrongPass.status).toBe(401);
    expect(wrongEmail.status).toBe(401);
    expect(wrongPass.json).toEqual(wrongEmail.json);
  });

  it("A2-3 logout → cookie ถูกลบ", async () => {
    const u = await makeUser();
    const r = await call(logout, "/api/auth/logout", { method: "POST", as: u });
    expect(r.res.headers.get("set-cookie")).toMatch(/session=;.*Max-Age=0/i);
    expect((await call(me, "/api/auth/me")).status).toBe(401);
  });

  it("A2-4 ผิด 5 ครั้งใน 15 นาที → ครั้งที่ 6 ได้ 429 แม้รหัสถูก", async () => {
    const u = await makeUser();
    for (let i = 0; i < 5; i++) {
      const r = await call(login, "/api/auth/login", {
        method: "POST",
        body: { email: u.email, password: "nope" },
      });
      expect(r.status).toBe(401);
    }
    const r = await call(login, "/api/auth/login", {
      method: "POST",
      body: { email: u.email, password: PASSWORD },
    });
    expect(r.status).toBe(429);
  });

  it("A2-5 บัญชีถูกระงับ → login 403 และ cookie เดิมเรียก API ได้ 403 ทันที", async () => {
    const u = await makeUser();
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, u.id));
    const r = await call(login, "/api/auth/login", {
      method: "POST",
      body: { email: u.email, password: PASSWORD },
    });
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe("ACCOUNT_SUSPENDED");
    const meRes = await call(me, "/api/auth/me", { as: u });
    expect(meRes.status).toBe(403);
    expect(meRes.json.error.code).toBe("ACCOUNT_SUSPENDED");
  });
});

describe("US-A3 กันสิทธิ์", () => {
  it("A3-5 cookie ปลอม (role admin เซ็นด้วย key อื่น) → 401", async () => {
    const u = await makeUser();
    const forged = await new SignJWT({ role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(String(u.id))
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("x".repeat(48)));
    expect((await call(me, "/api/auth/me", { token: forged })).status).toBe(401);
  });

  it("role ใน token เป็น admin แต่ใน DB เป็น user → เรียก /api/admin ไม่ได้ (เชื่อ DB ไม่เชื่อ token)", async () => {
    const u = await makeUser();
    const { GET } = await import("@/app/api/admin/users/route");
    const r = await call(GET, "/api/admin/users", { as: { id: u.id, role: "admin" } });
    expect(r.status).toBe(403);
  });

  it("A3-6 POST ที่ Origin ไม่ตรง / ไม่มี Origin → 403", async () => {
    const u = await makeUser();
    const body = { email: u.email, password: PASSWORD };
    const evil = await call(login, "/api/auth/login", {
      method: "POST",
      body,
      origin: "https://evil.example",
    });
    const none = await call(login, "/api/auth/login", { method: "POST", body, origin: null });
    expect(evil.status).toBe(403);
    expect(none.status).toBe(403);
  });
});

// ─── A3-7 / A3-2 ไล่ทุก route จริง ────────────────────────────────

const API_DIR = join(process.cwd(), "src", "app", "api");
const PUBLIC_ROUTES = new Set([
  "health",
  "auth/register",
  "auth/login",
  "auth/logout",
  "categories",
  "services",
  "services/[slug]",
  "plans/[id]/price-history",
]);
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

/** หาไฟล์ route.ts ทุกไฟล์ใต้ src/app/api */
function findRoutes(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return findRoutes(path);
    return name === "route.ts" ? [path] : [];
  });
}

const protectedRoutes = findRoutes(API_DIR)
  .map((file) => ({ file, route: relative(API_DIR, file).split(sep).slice(0, -1).join("/") }))
  .filter((r) => !PUBLIC_ROUTES.has(r.route));

/** แทน [param] ด้วย 1 */
const pathOf = (route: string) => `/api/${route.replace(/\[[^\]]+\]/g, "1")}`;
const paramsOf = (route: string) =>
  Object.fromEntries([...route.matchAll(/\[([^\]]+)\]/g)].map((m) => [m[1], "1"]));

describe("A3-7 ทุก route ที่ไม่ใช่ public: ไม่ล็อกอิน → 401", () => {
  it.each(protectedRoutes)("/api/$route", async ({ file, route }) => {
    const mod = await import(/* @vite-ignore */ pathToFileURL(file).href);
    const methods = METHODS.filter((m) => typeof mod[m] === "function");
    expect(methods.length).toBeGreaterThan(0);
    for (const method of methods) {
      const r = await call(mod[method], pathOf(route), {
        method,
        body: method === "GET" ? undefined : {},
        params: paramsOf(route),
      });
      expect(r.status, `${method} /api/${route}`).toBe(401);
      expect(r.json.error.code).toBe("UNAUTHENTICATED");
    }
  });
});

describe("A3-2 role user เรียก /api/admin/* ทุกเส้น → 403", () => {
  it.each(protectedRoutes.filter((r) => r.route.startsWith("admin/")))(
    "/api/$route",
    async ({ file, route }) => {
      const u = await makeUser();
      const mod = await import(/* @vite-ignore */ pathToFileURL(file).href);
      for (const method of METHODS.filter((m) => typeof mod[m] === "function")) {
        const r = await call(mod[method], pathOf(route), {
          method,
          body: method === "GET" ? undefined : {},
          as: u,
          params: paramsOf(route),
        });
        expect(r.status, `${method} /api/${route}`).toBe(403);
      }
    },
  );

  it("admin ที่ถูกระงับก็เข้าไม่ได้", async () => {
    const a = await makeAdmin({ status: "suspended" });
    const { GET } = await import("@/app/api/admin/dashboard/route");
    expect((await call(GET, "/api/admin/dashboard", { as: a })).status).toBe(403);
  });
});

describe("ความปลอดภัยเพิ่มเติม (จากรอบ security audit)", () => {
  it("ยิงรหัสผิดพร้อมกัน 20 ครั้ง → ผ่านไปตรวจรหัสได้แค่ 5 ที่เหลือ 429", async () => {
    const u = await makeUser();
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        call(login, "/api/auth/login", { method: "POST", body: { email: u.email, password: "nope" } }),
      ),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 401)).toHaveLength(5);
    expect(statuses.filter((s) => s === 429)).toHaveLength(15);
  });

  it("ล็อกอินสำเร็จแล้วตัวนับรีเซ็ต", async () => {
    const u = await makeUser();
    for (let i = 0; i < 4; i++) {
      await call(login, "/api/auth/login", { method: "POST", body: { email: u.email, password: "nope" } });
    }
    const body = { email: u.email, password: PASSWORD };
    expect((await call(login, "/api/auth/login", { method: "POST", body })).status).toBe(200);
    expect((await call(login, "/api/auth/login", { method: "POST", body })).status).toBe(200);
  });

  it("Origin: null → 403 ไม่ใช่ 500", async () => {
    const r = await call(login, "/api/auth/login", {
      method: "POST",
      body: { email: "a@b.c", password: "x" },
      origin: "null",
    });
    expect(r.status).toBe(403);
  });
});

describe("logout ยกเลิก token เดิม", () => {
  it("token ที่ใช้ logout ไปแล้ว (เช่นถูกขโมย) เรียก API ไม่ได้ · ล็อกอินใหม่ได้ token ใหม่ที่ใช้ได้", async () => {
    const u = await makeUser();
    const body = { email: u.email, password: PASSWORD };
    const first = await call(login, "/api/auth/login", { method: "POST", body });
    const oldToken = /session=([^;]+)/.exec(first.res.headers.get("set-cookie") ?? "")![1];
    expect((await call(me, "/api/auth/me", { token: oldToken })).status).toBe(200);

    await call(logout, "/api/auth/logout", { method: "POST", token: oldToken });
    expect((await call(me, "/api/auth/me", { token: oldToken })).status).toBe(401);

    const again = await call(login, "/api/auth/login", { method: "POST", body });
    const newToken = /session=([^;]+)/.exec(again.res.headers.get("set-cookie") ?? "")![1];
    expect((await call(me, "/api/auth/me", { token: newToken })).status).toBe(200);
  });

  it("token แบบเก่าที่ไม่มี sv ยังใช้ได้ (ไม่เตะผู้ใช้ออกตอนอัปเดตระบบ)", async () => {
    const u = await makeUser();
    const legacy = await new SignJWT({ role: "user" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(String(u.id))
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));
    expect((await call(me, "/api/auth/me", { token: legacy })).status).toBe(200);
  });
});
