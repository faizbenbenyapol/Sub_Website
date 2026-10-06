import { jwtVerify, SignJWT } from "jose";

// เซ็น/ตรวจ JWT ของ session — แยกจาก server/auth.ts เพราะ proxy.ts ต้องใช้ด้วย
// และ proxy ห้ามแตะ DB หรือ import โมดูล "server-only"

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 วัน (วินาที)

export type SessionClaims = { userId: number; role: "user" | "admin" };

/** อ่าน secret จาก env ทุกครั้ง (proxy โหลดแยกจาก env.ts) */
function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET ไม่ได้ตั้งค่าหรือสั้นเกิน 32 ตัวอักษร");
  return new TextEncoder().encode(secret);
}

/** สร้าง token สำหรับใส่ cookie หลังสมัคร/ล็อกอินสำเร็จ */
export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ role: claims.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(claims.userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

/** ตรวจลายเซ็นและวันหมดอายุ — ผิดหรือหมดอายุคืน null ไม่โยน error */
export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const userId = Number(payload.sub);
    const role = payload.role;
    if (!Number.isInteger(userId) || (role !== "user" && role !== "admin")) return null;
    return { userId, role };
  } catch {
    return null;
  }
}
