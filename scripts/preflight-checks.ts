// ข้อตรวจของ preflight ที่ไม่ต้องต่อเน็ต/DB — แยกไว้ให้ unit test ได้ (tests/preflight.test.ts)
import type { Env } from "../src/server/env-schema";

export type Status = "ok" | "warn" | "fail" | "info";
export type Check = { status: Status; title: string; detail?: string; fix?: string };

const isLocalHost = (host: string) => ["localhost", "127.0.0.1", "[::1]"].includes(host);

/** ดึงอีเมลจาก "ชื่อ <a@b.c>" หรือ "a@b.c" */
export function emailOf(from: string): string | null {
  const m = /<([^>]+)>/.exec(from) ?? /(\S+@\S+)/.exec(from);
  return m ? m[1].trim().toLowerCase() : null;
}

/** ตรวจค่าตั้งที่ส่งผลกับ demo: APP_URL, อีเมล, Google, cron */
export function configChecks(env: Env, lanIps: string[] = []): Check[] {
  const out: Check[] = [];
  const app = new URL(env.APP_URL);
  const https = app.protocol === "https:";

  // APP_URL — ลิงก์ในอีเมล ลิงก์จ่ายเงิน และ redirect ของ Google ใช้ค่านี้ทั้งหมด
  if (isLocalHost(app.hostname)) {
    out.push({
      status: "warn",
      title: `APP_URL = ${env.APP_URL} ใช้ได้เฉพาะเครื่องนี้`,
      detail: "ลิงก์จ่ายเงินที่ส่งให้เพื่อน และลิงก์ในอีเมล จะเปิดจากมือถือ/เครื่องอื่นไม่ได้",
      fix: lanIps.length
        ? `demo ผ่าน Wi-Fi: ตั้ง APP_URL=http://${lanIps[0]}:${app.port || "3000"} แล้ว build/รันใหม่`
        : "demo ผ่าน Wi-Fi: ตั้ง APP_URL เป็น http://<IP ของเครื่อง>:<พอร์ต>",
    });
  } else {
    out.push({ status: "ok", title: `APP_URL = ${env.APP_URL}` });
  }
  if (app.pathname !== "/" || env.APP_URL.endsWith("/")) {
    out.push({ status: "fail", title: "APP_URL ต้องไม่มี / หรือ path ต่อท้าย", fix: `ใช้ ${app.origin}` });
  }
  out.push(
    https
      ? { status: "ok", title: "HTTPS: cookie เป็น Secure และส่ง HSTS" }
      : {
          status: "info",
          title: "ใช้ http: cookie ไม่ตั้ง Secure (ปกติสำหรับ demo ในวง LAN)",
          detail: "ขึ้น server จริงให้ใช้ https:// (docs/05-deploy.md)",
        },
  );

  // อีเมล
  if (env.MAIL_TRANSPORT === "console") {
    out.push({
      status: "warn",
      title: "MAIL_TRANSPORT=console: อีเมลพิมพ์ลง log ไม่ได้ส่งจริง",
      fix: "ตั้ง MAIL_TRANSPORT=smtp + SMTP_USER + SMTP_PASS (Gmail App Password) — README หัวข้ออีเมลแจ้งเตือน",
    });
  } else {
    if (env.SMTP_PASS && /\s/.test(env.SMTP_PASS)) {
      out.push({
        status: "fail",
        title: "SMTP_PASS มีเว้นวรรค",
        fix: "App Password 16 ตัวต้องพิมพ์ติดกัน ไม่มีเว้นวรรค",
      });
    }
    const from = env.MAIL_FROM ? emailOf(env.MAIL_FROM) : null;
    if (from && env.SMTP_USER && from !== env.SMTP_USER.toLowerCase()) {
      out.push({
        status: "warn",
        title: `MAIL_FROM (${from}) ไม่ตรงกับ SMTP_USER (${env.SMTP_USER})`,
        detail: "Gmail จะเปลี่ยนผู้ส่งเป็น SMTP_USER เอง และเมลมีโอกาสตก Spam",
        fix: `ตั้ง MAIL_FROM="ตัดยัง? <${env.SMTP_USER}>"`,
      });
    }
  }

  // งานเตือนรายวัน
  out.push(
    env.CRON_ENABLED
      ? { status: "ok", title: "CRON_ENABLED=true: เตือนทุกวัน 08:00 และตอนเปิดเซิร์ฟเวอร์" }
      : {
          status: "warn",
          title: "CRON_ENABLED=false: อีเมลเตือนรายวันไม่รันเอง",
          fix: "ตั้ง CRON_ENABLED=true หรือสั่งเองด้วย curl -X POST .../api/cron/reminders (README)",
        },
  );

  // Google
  const id = env.GOOGLE_CLIENT_ID;
  const secret = env.GOOGLE_CLIENT_SECRET;
  if (!id && !secret) {
    out.push({
      status: "info",
      title: "เข้าสู่ระบบด้วย Google: ปิดอยู่ (ไม่ได้ตั้ง GOOGLE_CLIENT_ID) ปุ่มจะไม่แสดง",
    });
  } else if (!id || !secret) {
    out.push({
      status: "fail",
      title: "ตั้ง Google ไม่ครบ: ต้องมีทั้ง GOOGLE_CLIENT_ID และ GOOGLE_CLIENT_SECRET",
    });
  } else {
    if (!https && !isLocalHost(app.hostname)) {
      out.push({
        status: "fail",
        title: `Google ไม่ยอม redirect กลับมาที่ ${app.origin}`,
        detail: "Google รับเฉพาะ https:// หรือ http://localhost",
        fix: "ใช้โดเมน https (docs/05-deploy.md) หรือเว้น GOOGLE_* ว่างตอน demo ผ่าน IP",
      });
    } else {
      out.push({
        status: "ok",
        title: "เข้าสู่ระบบด้วย Google: เปิดอยู่",
        detail: `Authorized redirect URI ใน Google Cloud Console ต้องเป็น ${app.origin}/api/auth/google/callback`,
      });
    }
    if (!id.endsWith(".apps.googleusercontent.com")) {
      out.push({
        status: "warn",
        title: "GOOGLE_CLIENT_ID ไม่ลงท้ายด้วย .apps.googleusercontent.com",
        fix: "คัดลอก Client ID จาก Google Cloud Console → Credentials อีกครั้ง",
      });
    }
  }
  return out;
}
