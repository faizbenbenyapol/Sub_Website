// การเชื่อมต่อ DB สำหรับสคริปต์ที่รันด้วย tsx (src/db/index.ts ใช้ไม่ได้เพราะ import "server-only")
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../src/db/schema";

/** เปิด pool ใหม่ — สคริปต์ต้องเรียก pool.end() เองเมื่อเสร็จ */
export function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("ไม่พบ DATABASE_URL — รันด้วย tsx --env-file=.env");
  const pool = mysql.createPool({ uri: url, timezone: "Z", connectionLimit: 2 });
  const db = drizzle({ client: pool, schema, mode: "default", casing: "snake_case" });
  return { pool, db };
}
