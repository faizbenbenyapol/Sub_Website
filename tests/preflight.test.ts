import { describe, expect, it } from "vitest";
import { configChecks, emailOf } from "../scripts/preflight-checks";
import { parseEnv, type Env } from "../src/server/env-schema";

// ข้อตรวจของ npm run preflight ที่ไม่ต้องต่อเน็ต

const base = {
  DATABASE_URL: "mysql://u:p@localhost:3307/tadyang",
  SESSION_SECRET: "x".repeat(40),
  CRON_SECRET: "y".repeat(20),
  APP_URL: "http://localhost:3000",
};
const envOf = (over: Record<string, string> = {}): Env => {
  const { env, issues } = parseEnv({ ...base, ...over });
  if (!env) throw new Error(issues.join(", "));
  return env;
};
const titles = (env: Env, ips: string[] = []) => configChecks(env, ips).map((c) => `${c.status}: ${c.title}`);
const find = (env: Env, text: string, ips: string[] = []) =>
  configChecks(env, ips).find((c) => c.title.includes(text));

describe("preflight configChecks", () => {
  it("APP_URL เป็น localhost → เตือน พร้อมแนะนำ IP ในวง LAN และพอร์ตเดิม", () => {
    const c = find(envOf({ APP_URL: "http://localhost:3100" }), "ใช้ได้เฉพาะเครื่องนี้", ["192.168.1.20"]);
    expect(c?.status).toBe("warn");
    expect(c?.fix).toContain("APP_URL=http://192.168.1.20:3100");
  });

  it("APP_URL มี / ต่อท้าย → ต้องแก้", () => {
    expect(find(envOf({ APP_URL: "https://tadyang.example.com/" }), "ต่อท้าย")?.status).toBe("fail");
  });

  it("console mail → เตือนว่าไม่ส่งจริง · smtp + รหัสมีเว้นวรรค → ต้องแก้ · MAIL_FROM ไม่ตรง → เตือน", () => {
    expect(find(envOf(), "console")?.status).toBe("warn");
    const smtp = envOf({
      MAIL_TRANSPORT: "smtp",
      SMTP_USER: "proj@gmail.com",
      SMTP_PASS: "abcd efgh ijkl mnop",
      MAIL_FROM: "ตัดยัง? <other@gmail.com>",
    });
    expect(find(smtp, "เว้นวรรค")?.status).toBe("fail");
    expect(find(smtp, "MAIL_FROM")?.status).toBe("warn");
  });

  it("Google: ไม่ตั้ง = info · ตั้งครึ่งเดียว = fail · http://IP = fail · https = ok พร้อม redirect URI", () => {
    expect(find(envOf(), "Google")?.status).toBe("info");
    expect(find(envOf({ GOOGLE_CLIENT_ID: "a.apps.googleusercontent.com" }), "ไม่ครบ")?.status).toBe("fail");
    const google = { GOOGLE_CLIENT_ID: "a.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "s" };
    expect(find(envOf({ ...google, APP_URL: "http://192.168.1.20:3000" }), "ไม่ยอม redirect")?.status).toBe(
      "fail",
    );
    const ok = find(envOf({ ...google, APP_URL: "https://tadyang.example.com" }), "เปิดอยู่");
    expect(ok?.status).toBe("ok");
    expect(ok?.detail).toContain("https://tadyang.example.com/api/auth/google/callback");
  });

  it("ค่าครบแบบ production ไม่มีข้อ fail", () => {
    const prod = envOf({
      APP_URL: "https://tadyang.example.com",
      MAIL_TRANSPORT: "smtp",
      SMTP_USER: "proj@gmail.com",
      SMTP_PASS: "abcdefghijklmnop",
      MAIL_FROM: "ตัดยัง? <proj@gmail.com>",
      CRON_ENABLED: "true",
    });
    expect(titles(prod).filter((t) => t.startsWith("fail") || t.startsWith("warn"))).toEqual([]);
  });

  it("emailOf อ่านได้ทั้งแบบมีชื่อและไม่มี", () => {
    expect(emailOf('"ตัดยัง?" <A@Gmail.com>')).toBe("a@gmail.com");
    expect(emailOf("a@b.co")).toBe("a@b.co");
  });
});
