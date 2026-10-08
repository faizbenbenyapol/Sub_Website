import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as callback } from "@/app/api/auth/google/callback/route";
import { GET as start } from "@/app/api/auth/google/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { db } from "@/db";
import { users } from "@/db/schema";
import { encodePending, type GoogleProfile } from "@/server/google";
import { call, makeUser, PASSWORD } from "./helpers";

// เข้าสู่ระบบด้วย Google — mock เฉพาะการคุยกับ Google (แลก code + ตรวจ id_token) ส่วนอื่นรันจริงกับ DB

const { exchange } = vi.hoisted(() => ({ exchange: vi.fn() }));
vi.mock("@/server/google", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/google")>()),
  exchangeCodeForProfile: exchange,
}));

const profile = (over: Partial<GoogleProfile> = {}): GoogleProfile => ({
  sub: "google-sub-1",
  email: "mind@gmail.com",
  emailVerified: true,
  name: "มายด์ ใจดี",
  ...over,
});

/** เรียก callback เหมือน Google พากลับมา พร้อม cookie ที่หน้าเริ่มต้นตั้งไว้ */
function back(
  opts: { state?: string; cookieState?: string; next?: string | null; withCookie?: boolean } = {},
) {
  const state = opts.state ?? "state-123";
  const cookies: Record<string, string> =
    opts.withCookie === false
      ? {}
      : {
          g_oauth: encodePending({
            s: opts.cookieState ?? "state-123",
            v: "verifier-xyz",
            n: opts.next ?? null,
          }),
        };
  return call(callback, `/api/auth/google/callback?code=auth-code&state=${state}`, { cookies });
}

const location = (r: { res: Response }) => r.res.headers.get("location");
const sessionToken = (r: { res: Response }) =>
  /(?:^|,\s*)session=([^;]+)/.exec(r.res.headers.get("set-cookie") ?? "")?.[1];

beforeEach(() => {
  exchange.mockReset();
  exchange.mockResolvedValue(profile());
});

describe("เริ่มเข้าสู่ระบบด้วย Google", () => {
  it("พาไป Google พร้อม PKCE S256 + state และตั้ง cookie httpOnly · next ที่ชี้ออกนอกเว็บถูกตัดทิ้ง", async () => {
    const r = await call(start, `/api/auth/google?next=${encodeURIComponent("//evil.example")}`);
    expect(r.status).toBe(307);
    const url = new URL(location(r)!);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/google/callback");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    const cookie = r.res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^g_oauth=/);
    expect(cookie.toLowerCase()).toContain("httponly");
    const pending = JSON.parse(Buffer.from(/g_oauth=([^;]+)/.exec(cookie)![1], "base64url").toString());
    expect(pending.s).toBe(url.searchParams.get("state"));
    expect(pending.n).toBeNull();
  });
});

describe("Google พากลับมา (callback)", () => {
  it("ผู้ใช้ใหม่ → สร้างบัญชีไม่มีรหัสผ่าน เปิดแจ้งเตือน 3 วันให้เลย แล้วเข้าสู่ระบบไปหน้า next", async () => {
    const r = await back({ next: "/calendar" });
    expect(r.status).toBe(307);
    expect(location(r)).toBe("http://localhost:3000/calendar");
    expect(exchange).toHaveBeenCalledWith("auth-code", "verifier-xyz");
    const [u] = await db.select().from(users).where(eq(users.email, "mind@gmail.com"));
    expect(u).toMatchObject({
      name: "มายด์ ใจดี",
      googleSub: "google-sub-1",
      passwordHash: null,
      role: "user",
      notifyEnabled: true,
      notifyDaysBefore: 3,
    });
    expect((await call(me, "/api/auth/me", { token: sessionToken(r) })).json.data.email).toBe(
      "mind@gmail.com",
    );
    expect(r.res.headers.get("set-cookie")).toMatch(/g_oauth=;/); // cookie ชั่วคราวถูกลบ ใช้ซ้ำไม่ได้
  });

  it("ครั้งถัดไปหาจาก sub — แม้อีเมลใน Google เปลี่ยนก็ยังเป็นบัญชีเดิม", async () => {
    await back();
    exchange.mockResolvedValue(profile({ email: "new-address@gmail.com" }));
    const r = await back();
    expect(location(r)).toBe("http://localhost:3000/dashboard");
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("state ไม่ตรง / ไม่มี cookie → กลับหน้า login พร้อม error และไม่คุยกับ Google", async () => {
    for (const r of [await back({ state: "forged" }), await back({ withCookie: false })]) {
      expect(location(r)).toBe("http://localhost:3000/login?error=google");
      expect(sessionToken(r)).toBeUndefined();
    }
    expect(exchange).not.toHaveBeenCalled();
  });

  it("แลก code ไม่สำเร็จ (id_token ปลอม/หมดอายุ) → error=google", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    exchange.mockRejectedValue(new Error("signature verification failed"));
    expect(location(await back())).toBe("http://localhost:3000/login?error=google");
  });

  it("อีเมลที่ Google ยังไม่ยืนยัน → error=unverified และไม่สร้างบัญชี", async () => {
    exchange.mockResolvedValue(profile({ emailVerified: false }));
    expect(location(await back())).toBe("http://localhost:3000/login?error=unverified");
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it("บัญชีถูกระงับ → error=suspended", async () => {
    await makeUser({ email: "mind@gmail.com", status: "suspended" });
    expect(location(await back())).toBe("http://localhost:3000/login?error=suspended");
  });

  it("มีบัญชีรหัสผ่านอีเมลเดียวกัน → ผูก Google, ยกเลิกรหัสผ่านเดิม และ token เดิมใช้ไม่ได้ (กัน pre-hijacking)", async () => {
    const existing = await makeUser({ email: "mind@gmail.com", name: "สมัครไว้ก่อน" });
    const before = await call(login, "/api/auth/login", {
      method: "POST",
      body: { email: "mind@gmail.com", password: PASSWORD },
    });
    const oldToken = sessionToken(before);

    const r = await back();
    expect(location(r)).toBe("http://localhost:3000/dashboard");
    const [u] = await db.select().from(users).where(eq(users.id, existing.id));
    expect(u).toMatchObject({ googleSub: "google-sub-1", passwordHash: null, name: "สมัครไว้ก่อน" });
    expect((await call(me, "/api/auth/me", { token: oldToken })).status).toBe(401);
    const pwLogin = await call(login, "/api/auth/login", {
      method: "POST",
      body: { email: "mind@gmail.com", password: PASSWORD },
    });
    expect(pwLogin.status).toBe(401); // บัญชีไม่มีรหัสผ่าน → ข้อความเดียวกับรหัสผิด ไม่ใช่ 500
    expect((await call(me, "/api/auth/me", { token: sessionToken(r) })).status).toBe(200);
  });

  it("admin ที่ผูก Google แล้วไปหน้า /admin", async () => {
    await makeUser({ email: "mind@gmail.com", role: "admin", googleSub: "google-sub-1" });
    expect(location(await back())).toBe("http://localhost:3000/admin");
  });
});
