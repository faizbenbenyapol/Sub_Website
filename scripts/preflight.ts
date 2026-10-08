// เช็กความพร้อมก่อน demo / หลัง deploy: .env, ฐานข้อมูล, migration, ข้อมูลเริ่มต้น, ล็อกอิน Gmail จริง (ไม่ส่งเมล), APP_URL, Google
// ใช้: npm run preflight  (บน server: docker compose -f docker-compose.prod.yml exec app npx tsx scripts/preflight.ts)
// ไม่แก้ข้อมูลใด ๆ · มีข้อ ✗ = exit code 1
import { readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import mysql, { type RowDataPacket } from "mysql2/promise";
import nodemailer from "nodemailer";
import { parseEnv, type Env } from "../src/server/env-schema";
import { configChecks, type Check } from "./preflight-checks";

const ICON = { ok: "✓", warn: "!", fail: "✗", info: "·" } as const;

/** IPv4 ของเครื่องในวง LAN (ไว้แนะนำ APP_URL ตอน demo บนมือถือ) */
function lanIps(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === "IPv4" && !n.internal)
    .map((n) => n!.address);
}

/** ล้ม promise ถ้าเกินเวลา */
function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${what} เกิน ${ms / 1000} วินาที`)), ms),
    ),
  ]);
}

/** ฐานข้อมูล: ต่อได้, migration ครบ, มีข้อมูลเริ่มต้น */
async function databaseChecks(env: Env): Promise<Check[]> {
  let conn: mysql.Connection;
  try {
    conn = await withTimeout(mysql.createConnection({ uri: env.DATABASE_URL }), 5000, "ต่อฐานข้อมูล");
  } catch (err) {
    return [
      {
        status: "fail",
        title: "ต่อฐานข้อมูลไม่ได้",
        // ECONNREFUSED ของ mysql2 มีแต่ code ไม่มี message
        detail: (err as Error).message || (err as { code?: string }).code || String(err),
        fix: "เครื่องพัฒนา: npm run db:up · server: docker compose -f docker-compose.prod.yml ps",
      },
    ];
  }
  const out: Check[] = [{ status: "ok", title: "ต่อฐานข้อมูลได้" }];
  try {
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: unknown[] };
    const [applied] = await conn
      .query<RowDataPacket[]>("select count(*) as n from __drizzle_migrations")
      .catch(() => [[{ n: 0 }] as RowDataPacket[]]);
    const n = Number(applied[0].n);
    out.push(
      n >= journal.entries.length
        ? { status: "ok", title: `migration ครบ (${n}/${journal.entries.length})` }
        : {
            status: "fail",
            title: `migration ค้าง (${n}/${journal.entries.length})`,
            fix: "เครื่องพัฒนา: npm run db:migrate · server: รีสตาร์ต app (migrate ตอนเปิดเอง)",
          },
    );
    if (n === 0) return out;

    const one = async (sql: string, params: unknown[] = []) =>
      Number((await conn.query<RowDataPacket[]>(sql, params))[0][0].n);
    const services = await one("select count(*) as n from services where is_active = 1");
    const admins = await one("select count(*) as n from users where role = 'admin' and status = 'active'");
    out.push(
      services > 0
        ? { status: "ok", title: `คลังบริการ ${services} บริการ` }
        : {
            status: "fail",
            title: "คลังบริการว่าง",
            fix: "รัน seed: npm run db:seed (server: exec app npx tsx scripts/seed.ts)",
          },
    );
    out.push(
      admins > 0
        ? { status: "ok", title: `บัญชี admin ${admins} บัญชี` }
        : {
            status: "warn",
            title: "ยังไม่มีบัญชี admin",
            fix: "ตั้ง ADMIN_EMAIL / ADMIN_PASSWORD แล้วรัน seed",
          },
    );
    const demo = process.env.DEMO_EMAIL?.toLowerCase();
    if (demo) {
      const has = await one("select count(*) as n from users where email = ?", [demo]);
      out.push(
        has
          ? { status: "ok", title: `บัญชีตัวอย่าง ${demo} มีอยู่` }
          : { status: "warn", title: `ไม่พบบัญชีตัวอย่าง ${demo}`, fix: "รัน seed" },
      );
    }
  } finally {
    await conn.end();
  }
  return out;
}

/** ล็อกอิน SMTP จริงโดยไม่ส่งเมล */
async function smtpCheck(env: Env): Promise<Check[]> {
  if (env.MAIL_TRANSPORT !== "smtp") return [];
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  try {
    await withTimeout(transport.verify(), 15000, "เชื่อมต่อ SMTP");
    return [
      { status: "ok", title: `ล็อกอิน ${env.SMTP_HOST} ด้วย ${env.SMTP_USER} สำเร็จ (ยังไม่ได้ส่งเมล)` },
    ];
  } catch (err) {
    const msg = (err as Error).message;
    return [
      {
        status: "fail",
        title: "ล็อกอิน SMTP ไม่สำเร็จ",
        detail: msg,
        fix: /535|Invalid login|Username and Password/i.test(msg)
          ? "App Password ผิด หรือบัญชียังไม่เปิดยืนยันตัวตน 2 ขั้น — สร้างใหม่ที่ myaccount.google.com/apppasswords"
          : "เช็กอินเทอร์เน็ต / SMTP_HOST / SMTP_PORT (Gmail = smtp.gmail.com:465)",
      },
    ];
  } finally {
    transport.close();
  }
}

/** เว็บที่ APP_URL ตอบอยู่ไหม (ถ้าเปิดเซิร์ฟเวอร์ไว้) */
async function appUrlCheck(env: Env): Promise<Check[]> {
  try {
    const res = await withTimeout(fetch(`${env.APP_URL}/api/health`), 5000, "เรียก APP_URL");
    return res.ok
      ? [{ status: "ok", title: `${env.APP_URL}/api/health ตอบปกติ` }]
      : [
          {
            status: "fail",
            title: `${env.APP_URL}/api/health ตอบ ${res.status}`,
            fix: "ดู log ของเซิร์ฟเวอร์",
          },
        ];
  } catch {
    return [
      {
        status: "warn",
        title: `เปิด ${env.APP_URL} ไม่ได้`,
        detail: "ยังไม่ได้เปิดเซิร์ฟเวอร์ หรือ APP_URL ไม่ตรงกับพอร์ตที่เปิดอยู่จริง",
        fix: "เปิดเว็บแล้วรันใหม่ · ถ้าเปิดอยู่ ให้แก้ APP_URL ให้ตรงพอร์ต (ลิงก์ในอีเมล/ลิงก์จ่ายเงินใช้ค่านี้)",
      },
    ];
  }
}

/** พิมพ์ผลเป็นกลุ่ม */
function print(group: string, checks: Check[]) {
  if (checks.length === 0) return;
  console.log(`\n${group}`);
  for (const c of checks) {
    console.log(`  ${ICON[c.status]} ${c.title}`);
    if (c.detail) console.log(`      ${c.detail}`);
    if (c.fix) console.log(`      → ${c.fix}`);
  }
}

async function main() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // ใน container ค่ามาจาก environment ตรง ๆ ไม่มีไฟล์ .env
  }
  console.log("ตัดยัง? preflight — เช็กความพร้อมก่อน demo / หลัง deploy");

  const { env, issues } = parseEnv(process.env);
  if (!env) {
    print(
      ".env",
      issues.map((i) => ({ status: "fail" as const, title: i })),
    );
    print("", [{ status: "fail", title: "แก้ .env ก่อน แล้วรันใหม่ (ดู .env.example)" }]);
    process.exitCode = 1;
    return;
  }
  const all: Check[] = [];
  const run = (group: string, checks: Check[]) => {
    print(group, checks);
    all.push(...checks);
  };
  run("ค่าตั้ง (.env)", configChecks(env, lanIps()));
  run("ฐานข้อมูล", await databaseChecks(env));
  run("อีเมล", await smtpCheck(env));
  run("เว็บ", await appUrlCheck(env));

  const fails = all.filter((c) => c.status === "fail").length;
  const warns = all.filter((c) => c.status === "warn").length;
  console.log(
    `\n${fails ? `✗ ต้องแก้ ${fails} ข้อ` : "✓ ไม่มีข้อที่ต้องแก้"}${warns ? ` · ควรดู ${warns} ข้อ` : ""}\n`,
  );
  if (fails) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
