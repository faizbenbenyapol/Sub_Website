import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { hashPassword, verifyPassword } from "../auth";
import { ApiError } from "../http";
import { hit, reset } from "../rate-limit";

// บัญชีของฉัน: ยืนยันรหัสเดิม และเปลี่ยนรหัสผ่าน (หน้าตั้งค่า)

const MAX_TRIES = 5;
const WINDOW_MS = 15 * 60 * 1000;

/**
 * ตรวจรหัสเดิม — ผิดได้ 5 ครั้งใน 15 นาทีต่อบัญชี (กันคนที่ได้เครื่องที่ล็อกอินค้างไว้มาเดารหัส)
 * นับครั้งก่อนเทียบ bcrypt เหมือนหน้า login เพื่อไม่ให้คำขอพร้อมกันหลายตัวหลุดผ่าน
 */
export async function checkCurrentPassword(user: User, currentPassword: string | undefined) {
  if (!user.passwordHash) return; // เข้าด้วย Google อย่างเดียว ยังไม่เคยตั้งรหัส
  const key = `password:${user.id}`;
  if (!hit(key, MAX_TRIES, WINDOW_MS)) {
    throw new ApiError(429, "RATE_LIMITED", "กรอกรหัสเดิมผิดหลายครั้งเกินไป รอ 15 นาทีแล้วลองใหม่");
  }
  if (!currentPassword || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new ApiError(400, "VALIDATION_ERROR", "รหัสผ่านเดิมไม่ถูกต้อง", {
      currentPassword: "รหัสผ่านเดิมไม่ถูกต้อง",
    });
  }
  reset(key);
}

/** ตั้งรหัสใหม่ + เพิ่ม session_version ให้เครื่องอื่นที่ล็อกอินค้างอยู่หลุด คืนผู้ใช้ล่าสุดไว้ออก token ใหม่ให้เครื่องนี้ */
export async function changePassword(user: User, newPassword: string): Promise<User> {
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, user.id));
  const [fresh] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  return fresh;
}
