// สร้าง DB ของ E2E (ถ้ายังไม่มี) + ให้สิทธิ์ user ของแอป — ตาราง/ข้อมูลทำต่อด้วย scripts/reset.ts และ seed.ts
import mysql from "mysql2/promise";

const ROOT_URL = process.env.TEST_DB_ROOT_URL ?? "mysql://root:root@localhost:3307";

/** สร้าง DB ตามชื่อใน DATABASE_URL — ยอมเฉพาะ tadyang_e2e กันเผลอไปแตะ DB อื่น */
async function main() {
  const name = new URL(process.env.DATABASE_URL ?? "mysql://x/").pathname.slice(1);
  if (name !== "tadyang_e2e") throw new Error(`create-db ใช้กับ tadyang_e2e เท่านั้น (ได้ "${name}")`);
  const root = await mysql.createConnection({ uri: ROOT_URL });
  try {
    await root.query(
      `create database if not exists \`${name}\` character set utf8mb4 collate utf8mb4_0900_ai_ci`,
    );
    await root.query(`grant all privileges on \`${name}\`.* to 'tadyang'@'%'`);
  } finally {
    await root.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
