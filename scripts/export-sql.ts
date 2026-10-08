// สร้างไฟล์ SQL สำหรับส่งงาน: โครงสร้างทุกตาราง + ข้อมูลตัวอย่าง (หมวด, 18 บริการ, บัญชี admin/demo)
// ใช้: npm run db:export → submission/tadyang.sql
// ทำงานบน DB ชั่วคราว `tadyang_export` (สร้าง → migrate → seed → dump → ลบทิ้ง) จึงไม่แตะข้อมูลใน DB `tadyang` ที่ใช้พัฒนา
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";

const ROOT_URL = "mysql://root:root@localhost:3307";
const EXPORT_DB = "tadyang_export";
const OUT = join("submission", "tadyang.sql");

// บัญชีตัวอย่างในไฟล์ส่งงาน — รหัสผ่านนี้ตั้งใจเปิดเผยให้ผู้ตรวจล็อกอินได้ (ไม่ใช่ค่าใน .env ของเครื่องพัฒนา)
export const SAMPLE_ACCOUNTS = {
  ADMIN_EMAIL: "admin@tadyang.local",
  ADMIN_PASSWORD: "Admin@1234",
  DEMO_EMAIL: "demo@tadyang.local",
  DEMO_PASSWORD: "Demo@1234",
};

/** รันสคริปต์ tsx อีกตัวกับ DB export */
function runScript(file: string) {
  // เรียก CLI ของ tsx ผ่าน node ตรง ๆ — ไม่ต้องพึ่ง shell (npx.cmd บน Windows)
  execFileSync(process.execPath, [join("node_modules", "tsx", "dist", "cli.mjs"), file], {
    stdio: "inherit",
    env: {
      ...process.env,
      ...SAMPLE_ACCOUNTS,
      DATABASE_URL: `mysql://tadyang:tadyang@localhost:3307/${EXPORT_DB}`,
    },
  });
}

/** ปรับ dump ให้ import ได้ทั้ง MySQL 8 และ MariaDB (XAMPP) */
function makePortable(sql: string): string {
  return (
    sql
      // MariaDB ไม่รู้จัก collation ของ MySQL 8
      .replaceAll("utf8mb4_0900_ai_ci", "utf8mb4_unicode_ci")
      // MariaDB อ่าน /*!80016 … */ เป็นคำสั่งจริงเพราะเลขเวอร์ชันสูงกว่า แล้ว error
      .replace(/\/\*!80016 DEFAULT ENCRYPTION='N' \*\//g, "")
  );
}

async function main() {
  const root = await mysql.createConnection({ uri: ROOT_URL });
  try {
    await root.query(`drop database if exists \`${EXPORT_DB}\``);
    await root.query(`create database \`${EXPORT_DB}\` character set utf8mb4 collate utf8mb4_0900_ai_ci`);
    await root.query(`grant all privileges on \`${EXPORT_DB}\`.* to 'tadyang'@'%'`);

    runScript("scripts/reset.ts");
    runScript("scripts/seed.ts");

    const dump = execFileSync(
      "docker",
      [
        "exec",
        "tadyang-db",
        "mysqldump",
        "-uroot",
        "-proot",
        "--single-transaction",
        "--skip-comments",
        "--skip-dump-date",
        "--no-tablespaces",
        "--complete-insert",
        "--default-character-set=utf8mb4",
        EXPORT_DB,
      ],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
    );

    const header = `-- ตัดยัง? — โครงสร้างฐานข้อมูล + ข้อมูลตัวอย่าง (สร้างด้วย npm run db:export)
-- import: mysql -u root -p < tadyang.sql  หรือ phpMyAdmin → Import (สร้าง database \`tadyang\` ให้เอง)
-- ทดสอบ import แล้วกับ MySQL 8.4 (ที่เว็บใช้จริง ตาม docker-compose.yml) และ MariaDB 10.4 ของ XAMPP
--
-- บัญชีตัวอย่าง:
--   Admin : ${SAMPLE_ACCOUNTS.ADMIN_EMAIL} / ${SAMPLE_ACCOUNTS.ADMIN_PASSWORD}
--   ผู้ใช้ : ${SAMPLE_ACCOUNTS.DEMO_EMAIL} / ${SAMPLE_ACCOUNTS.DEMO_PASSWORD}  (มี 7 รายการ — วันตัดเงินที่ผ่านไปแล้วระบบเลื่อนให้เองตอนเปิดดู)
-- รหัสผ่านเก็บเป็น bcrypt hash · ราคาในคลังเก็บเมื่อ 6 ต.ค. 2569 (แหล่งอ้างอิงใน scripts/seed-data.ts)

SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS \`tadyang\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`tadyang\`;

`;
    mkdirSync("submission", { recursive: true });
    writeFileSync(OUT, header + makePortable(dump), "utf8");
    console.log(`เขียน ${OUT} แล้ว`);
  } finally {
    await root.query(`drop database if exists \`${EXPORT_DB}\``);
    await root.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
