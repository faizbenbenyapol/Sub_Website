import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { isDuplicateKey } from "@/db/errors";
import { users, type User } from "@/db/schema";
import type { GoogleProfile } from "../google";

// หาหรือสร้างบัญชีจากโปรไฟล์ Google (US-A1/A2 ทางเลือก) — ผู้ใช้ใหม่ได้ค่าแจ้งเตือนเริ่มต้น (เปิด, 3 วัน) ทันทีจาก default ของตาราง

export class GoogleSignInError extends Error {
  constructor(public reason: "unverified" | "suspended") {
    super(reason);
  }
}

/** โหลดผู้ใช้จาก id */
const byId = async (id: number) => (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];

/**
 * 1) เคยผูก Google นี้แล้ว → บัญชีนั้น
 * 2) มีบัญชีอีเมลเดียวกัน → ผูก Google เข้าไป และ**ยกเลิกรหัสผ่านเดิม + เตะ session อื่นออก**
 *    เพราะการสมัครด้วยรหัสผ่านไม่ได้ยืนยันอีเมล คนอื่นอาจสมัครอีเมลนี้ดักไว้ก่อน (account pre-hijacking)
 * 3) ไม่มี → สร้างบัญชีใหม่ที่ไม่มีรหัสผ่าน
 */
export async function signInWithGoogle(profile: GoogleProfile): Promise<User> {
  if (!profile.emailVerified) throw new GoogleSignInError("unverified");

  let user = (await db.select().from(users).where(eq(users.googleSub, profile.sub)).limit(1))[0];
  if (!user) {
    const [existing] = await db.select().from(users).where(eq(users.email, profile.email)).limit(1);
    if (existing) {
      await db
        .update(users)
        .set({
          googleSub: profile.sub,
          ...(existing.passwordHash !== null && {
            passwordHash: null,
            sessionVersion: sql`${users.sessionVersion} + 1`,
          }),
        })
        .where(eq(users.id, existing.id));
      user = await byId(existing.id);
    } else {
      const name = (profile.name?.trim() || profile.email.split("@")[0]).slice(0, 100);
      try {
        const [{ id }] = await db
          .insert(users)
          .values({ name, email: profile.email, googleSub: profile.sub, passwordHash: null })
          .$returningId();
        user = await byId(id);
      } catch (err) {
        // กดเข้าพร้อมกันสองแท็บ: อีกคำขอสร้างไปก่อนแล้ว
        if (!isDuplicateKey(err)) throw err;
        user = (await db.select().from(users).where(eq(users.googleSub, profile.sub)).limit(1))[0];
        if (!user) throw err;
      }
    }
  }
  if (user.status === "suspended") throw new GoogleSignInError("suspended");
  return user;
}
