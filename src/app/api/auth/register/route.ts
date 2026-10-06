import { eq } from "drizzle-orm";
import { db } from "@/db";
import { isDuplicateKey } from "@/db/errors";
import { users } from "@/db/schema";
import { registerSchema } from "@/lib/validation/auth";
import { attachSession, hashPassword, toPublicUser } from "@/server/auth";
import { api, ApiError, ok, parseBody } from "@/server/http";

/** สมัครสมาชิก — สร้างบัญชี role user เสมอ (ไม่รับ role จาก body) แล้วเข้าสู่ระบบให้ทันที */
export const POST = api(async (req) => {
  const input = await parseBody(req, registerSchema);
  const passwordHash = await hashPassword(input.password);

  let id: number;
  try {
    [{ id }] = await db
      .insert(users)
      .values({ name: input.name, email: input.email, passwordHash })
      .$returningId();
  } catch (err) {
    if (isDuplicateKey(err)) {
      throw new ApiError(409, "EMAIL_TAKEN", "อีเมลนี้ถูกใช้แล้ว", { email: "อีเมลนี้ถูกใช้แล้ว" });
    }
    throw err;
  }

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return attachSession(ok(toPublicUser(user), { status: 201 }), user);
});
