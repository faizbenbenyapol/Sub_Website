import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/** ตรวจว่าเว็บและฐานข้อมูลพร้อมใช้งาน — ใช้ตอนตั้งค่าเครื่องและก่อน demo */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ data: { status: "ok", db: "ok" } });
  } catch (err) {
    console.error("[health] db error", err);
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "เชื่อมต่อฐานข้อมูลไม่ได้" } },
      { status: 503 },
    );
  }
}
