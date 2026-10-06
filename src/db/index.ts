import "server-only";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "@/server/env";
import * as schema from "./schema";

// เก็บ pool ไว้บน globalThis เพื่อไม่ให้ hot reload ตอน dev สร้าง connection ใหม่ทุกครั้งที่แก้ไฟล์
const globalForDb = globalThis as unknown as { mysqlPool?: mysql.Pool };

/** สร้าง connection pool — timestamp อ่าน/เขียนเป็น UTC เสมอ */
function createPool() {
  return mysql.createPool({
    uri: env.DATABASE_URL,
    connectionLimit: 10,
    timezone: "Z",
  });
}

export const pool = globalForDb.mysqlPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.mysqlPool = pool;

export const db = drizzle({ client: pool, schema, mode: "default", casing: "snake_case" });
