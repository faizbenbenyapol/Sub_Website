import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql, { type RowDataPacket } from "mysql2/promise";

// รันครั้งเดียวก่อนเทส integration ทั้งชุด: สร้าง DB `tadyang_test` (ด้วย root ของ docker-compose) แล้ว migrate ใหม่หมด
// ไม่แตะ DB `tadyang` ที่ใช้ตอนพัฒนา

const TEST_DB = "tadyang_test";
const ROOT_URL = process.env.TEST_DB_ROOT_URL ?? "mysql://root:root@localhost:3307";

/** สร้าง DB เทส + ให้สิทธิ์ user ของแอป แล้ว drop ทุกตาราง → migrate จาก drizzle/ */
export default async function setup() {
  let root: mysql.Connection;
  try {
    root = await mysql.createConnection({ uri: ROOT_URL });
  } catch (err) {
    throw new Error(`ต่อ MySQL ไม่ได้ (${ROOT_URL}) — รัน \`npm run db:up\` ก่อนเทส integration`, {
      cause: err,
    });
  }
  try {
    await root.query(
      `create database if not exists \`${TEST_DB}\` character set utf8mb4 collate utf8mb4_0900_ai_ci`,
    );
    await root.query(`grant all privileges on \`${TEST_DB}\`.* to 'tadyang'@'%'`);
    await root.query(`use \`${TEST_DB}\``);
    const [rows] = await root.query<RowDataPacket[]>(
      "select table_name as name from information_schema.tables where table_schema = database()",
    );
    await root.query("set foreign_key_checks = 0");
    for (const { name } of rows) await root.query(`drop table if exists \`${name}\``);
    await root.query("set foreign_key_checks = 1");
  } finally {
    await root.end();
  }

  const pool = mysql.createPool({ uri: `${ROOT_URL}/${TEST_DB}`, timezone: "Z", connectionLimit: 1 });
  try {
    await migrate(drizzle({ client: pool, mode: "default", casing: "snake_case" }), {
      migrationsFolder: "drizzle",
    });
  } finally {
    await pool.end();
  }
}
