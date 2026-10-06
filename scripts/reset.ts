// ล้างฐานข้อมูลทั้งหมด → รัน migration ใหม่ (ใช้ตอนพัฒนาหรือเตรียมเครื่อง demo เท่านั้น)
// ใช้: npm run db:reset (ตามด้วย seed อัตโนมัติ)
import type { RowDataPacket } from "mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { connect } from "./db";

if (process.env.NODE_ENV === "production") {
  console.error("ห้ามรัน db:reset บน production");
  process.exit(1);
}

const { pool, db } = connect();

/** drop ทุกตารางในฐานข้อมูลปัจจุบันแล้ว migrate ใหม่จากโฟลเดอร์ drizzle/ */
async function main() {
  const conn = await pool.getConnection(); // ใช้ connection เดียวเพื่อให้ foreign_key_checks มีผลกับทุกคำสั่ง
  try {
    const [rows] = await conn.query<RowDataPacket[]>(
      "select table_name as name from information_schema.tables where table_schema = database()",
    );
    await conn.query("set foreign_key_checks = 0");
    for (const { name } of rows) await conn.query(`drop table if exists \`${name}\``);
    await conn.query("set foreign_key_checks = 1");
    console.log(`ลบ ${rows.length} ตาราง`);
  } finally {
    conn.release();
  }
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("migrate เสร็จ");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
