// รัน migration ที่ยังไม่ได้รันกับ DATABASE_URL (ไม่ลบข้อมูล) — container ของแอปเรียกทุกครั้งก่อนเปิดเว็บ
// ใช้แทน drizzle-kit ซึ่งเป็น devDependency และไม่มีใน image production
import { migrate } from "drizzle-orm/mysql2/migrator";
import { connect } from "./db";

const { pool, db } = connect();

/** รอ DB พร้อม (container MySQL อาจยังเปิดไม่เสร็จ) แล้ว migrate */
async function main() {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query("select 1");
      break;
    } catch (err) {
      if (attempt >= 30) throw err;
      console.log(`รอฐานข้อมูล… (${attempt})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
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
