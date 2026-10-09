import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { attachSession, toPublicUser } from "@/server/auth";
import { demoLoginEnabled, env } from "@/server/env";
import { api, ApiError, clientIp, ok } from "@/server/http";
import { hit } from "@/server/rate-limit";

const MAX_PER_IP = 20;
const WINDOW_MS = 15 * 60 * 1000;

/**
 * เข้าสู่ระบบด้วยบัญชีตัวอย่างโดยไม่ต้องใช้รหัสผ่าน (ปุ่มหน้า login สำหรับ demo/ให้คนลองใช้)
 * เปิดเฉพาะเมื่อ DEMO_LOGIN=true · ล็อกอินได้แค่บัญชี DEMO_EMAIL ที่เป็น role user เท่านั้น — ไม่มีทางได้สิทธิ์ admin
 */
export const POST = api(async (req) => {
  if (!demoLoginEnabled) throw new ApiError(404, "NOT_FOUND", "ไม่ได้เปิดใช้บัญชีตัวอย่าง");
  if (!hit(`demo-ip:${clientIp(req)}`, MAX_PER_IP, WINDOW_MS)) {
    throw new ApiError(429, "RATE_LIMITED", "ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่");
  }
  const [user] = await db.select().from(users).where(eq(users.email, env.DEMO_EMAIL!)).limit(1);
  if (!user || user.role !== "user" || user.status !== "active") {
    throw new ApiError(404, "NOT_FOUND", "ยังไม่มีบัญชีตัวอย่าง (รัน npm run db:seed ก่อน)");
  }
  return attachSession(ok(toPublicUser(user)), user);
});
