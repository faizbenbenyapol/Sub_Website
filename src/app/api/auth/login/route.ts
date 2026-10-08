import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { loginSchema } from "@/lib/validation/auth";
import { attachSession, toPublicUser, verifyPassword } from "@/server/auth";
import { api, ApiError, clientIp, ok, parseBody } from "@/server/http";
import { hit, reset } from "@/server/rate-limit";

const MAX_FAILS = 5;
const MAX_PER_IP = 50; // กัน password spraying (รหัสเดียวลองหลายอีเมล) แต่หลวมพอให้ทั้งห้องเรียนหลัง NAT เดียวกัน
const WINDOW_MS = 15 * 60 * 1000;
// hash หลอกไว้เทียบเมื่อไม่พบอีเมล ให้เวลาตอบใกล้เคียงกับกรณีรหัสผิด (ไม่เผยว่าอีเมลมีในระบบไหม)
const DUMMY_HASH = "$2b$10$1fGnWRNUDQzCvNcHckvjouX1QGLlLeBOk13GEwAdR2tzreGu8dO12";

/**
 * เข้าสู่ระบบ — อีเมลผิดกับรหัสผิดได้ข้อความเดียวกัน, ผิด 5 ครั้งใน 15 นาทีโดนพัก
 * นับครั้ง*ก่อน* await bcrypt: ถ้านับหลัง คำขอที่ยิงพร้อมกันหลายร้อยตัวจะผ่านการเช็กไปพร้อมกันหมด
 */
export const POST = api(async (req) => {
  const { email, password } = await parseBody(req, loginSchema);
  const key = `login:${email}`;
  const ipAllowed = hit(`login-ip:${clientIp(req)}`, MAX_PER_IP, WINDOW_MS);
  if (!hit(key, MAX_FAILS, WINDOW_MS) || !ipAllowed) {
    throw new ApiError(429, "RATE_LIMITED", "ลองเข้าสู่ระบบผิดหลายครั้งเกินไป รอ 15 นาทีแล้วลองใหม่");
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  }
  if (user.status === "suspended") {
    throw new ApiError(403, "ACCOUNT_SUSPENDED", "บัญชีนี้ถูกระงับ ติดต่อผู้ดูแลระบบ");
  }

  reset(key);
  return attachSession(ok(toPublicUser(user)), user);
});
