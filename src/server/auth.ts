import "server-only";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "@/lib/session-token";
import { env } from "./env";
import { ApiError } from "./http";

const BCRYPT_COST = 10;

/** ข้อมูลผู้ใช้ที่ส่งออก API ได้ (ไม่มี passwordHash) — ตรงกับ type User ใน docs/02 ข้อ 5.2 */
export type PublicUser = {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  notifyEnabled: boolean;
  notifyDaysBefore: 1 | 3 | 7;
  createdAt: string;
};

/** ตัดฟิลด์ลับออกก่อนส่งให้ client */
export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    notifyEnabled: u.notifyEnabled,
    notifyDaysBefore: u.notifyDaysBefore as 1 | 3 | 7,
    createdAt: u.createdAt.toISOString(),
  };
}

/** hash รหัสผ่านก่อนบันทึก */
export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}

/** เทียบรหัสผ่านกับ hash ใน DB */
export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/** ตั้ง cookie session ลงใน response หลังสมัคร/ล็อกอินสำเร็จ */
export async function attachSession(res: NextResponse, user: Pick<User, "id" | "role" | "sessionVersion">) {
  const token = await signSession({ userId: user.id, role: user.role, sv: user.sessionVersion });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // ตามโปรโตคอลจริงของ APP_URL: demo ผ่าน http://IP ในวง LAN ด้วย next start ต้องไม่ใช่ Secure ไม่งั้นมือถือล็อกอินไม่ติด
    secure: env.APP_URL.startsWith("https://"),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

/** ทำให้ token ทุกใบของผู้ใช้ใช้ไม่ได้ (logout จากทุกเครื่อง) — ไม่มี session ที่ใช้ได้ก็ไม่ทำอะไร */
export async function revokeSessions() {
  const user = await getCurrentUser();
  if (user) {
    await db
      .update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, user.id));
  }
}

/** ลบ cookie session (logout) */
export function clearSession(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

/**
 * อ่านผู้ใช้ปัจจุบันจาก cookie แล้ว**โหลดจาก DB ทุกครั้ง** — ไม่เชื่อ role ใน token
 * คืน null ถ้าไม่ได้ล็อกอิน token ผิด หรือไม่พบผู้ใช้ (ใช้ได้ทั้งใน Server Component และ route handler)
 */
export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await verifySession(token);
  if (!claims) return null;
  const [user] = await db.select().from(users).where(eq(users.id, claims.userId)).limit(1);
  if (!user || user.sessionVersion !== claims.sv) return null; // logout แล้ว token เก่าใช้ไม่ได้
  return user;
}

/** สำหรับ API: ต้องล็อกอินและบัญชีไม่ถูกระงับ ไม่งั้นโยน 401/403 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบ");
  if (user.status === "suspended") {
    throw new ApiError(403, "ACCOUNT_SUSPENDED", "บัญชีนี้ถูกระงับ ติดต่อผู้ดูแลระบบ");
  }
  return user;
}

/** สำหรับ API ของหลังบ้าน: ต้องเป็น admin ที่ยังใช้งานได้ */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") throw new ApiError(403, "FORBIDDEN", "เฉพาะผู้ดูแลระบบ");
  return user;
}

/** หน้า login / register: ผู้ใช้ที่ล็อกอินอยู่และบัญชียังใช้งานได้ ไม่ต้องเห็นฟอร์ม (บัญชีที่ถูกระงับยังเห็นฟอร์มได้ ไม่วน redirect) */
export async function redirectIfSignedIn() {
  const user = await getCurrentUser();
  if (user?.status === "active") redirect(user.role === "admin" ? "/admin" : "/dashboard");
}
