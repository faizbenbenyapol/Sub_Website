import { afterAll, beforeEach, vi } from "vitest";

// โหลดก่อนทุกไฟล์ integration
// next/headers ใช้ได้เฉพาะใน request ของ Next จริง จึงจำลอง cookies() ให้อ่านจาก cookie ที่ helper call() ตั้งไว้

vi.mock("next/headers", () => ({
  cookies: async () => {
    const jar =
      (globalThis as { __testCookies?: Map<string, string> }).__testCookies ?? new Map<string, string>();
    return {
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
      has: (name: string) => jar.has(name),
    };
  },
}));

// ลำดับไม่สำคัญเพราะปิด foreign key check ระหว่างล้าง
const TABLES = [
  "feedback",
  "member_payments",
  "group_members",
  "share_groups",
  "notifications",
  "user_subscriptions",
  "price_history",
  "plans",
  "services",
  "categories",
  "users",
];

/** ล้างทุกตารางก่อนแต่ละเทส — เทสสร้างข้อมูลเองด้วย factory ไม่พึ่ง seed */
beforeEach(async () => {
  const { pool } = await import("@/db");
  const conn = await pool.getConnection();
  try {
    await conn.query("set foreign_key_checks = 0");
    for (const t of TABLES) await conn.query(`delete from \`${t}\``);
    await conn.query("set foreign_key_checks = 1");
  } finally {
    conn.release();
  }
});

afterAll(async () => {
  const { pool } = await import("@/db");
  await pool.end();
  delete (globalThis as { mysqlPool?: unknown }).mysqlPool;
});
