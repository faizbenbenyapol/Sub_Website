import { changePasswordSchema } from "@/lib/validation/auth";
import { attachSession, requireUser } from "@/server/auth";
import { api, ok, parseBody } from "@/server/http";
import { changePassword, checkCurrentPassword } from "@/server/services/account";

/**
 * เปลี่ยนรหัสผ่านของฉัน — ตรวจรหัสเดิมซ้ำฝั่ง server เสมอ (ขั้นยืนยันในหน้าเว็บเป็นแค่ UX)
 * เครื่องอื่นที่ล็อกอินค้างอยู่หลุดทั้งหมด ส่วนเครื่องนี้ได้ cookie ใหม่ ไม่ต้องล็อกอินซ้ำ
 */
export const PATCH = api(async (req) => {
  const user = await requireUser();
  const { currentPassword, newPassword } = await parseBody(req, changePasswordSchema);
  await checkCurrentPassword(user, currentPassword);
  const fresh = await changePassword(user, newPassword);
  return attachSession(ok({ changed: true }), fresh);
});
