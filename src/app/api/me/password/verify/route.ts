import { verifyPasswordSchema } from "@/lib/validation/auth";
import { requireUser } from "@/server/auth";
import { api, ok, parseBody } from "@/server/http";
import { checkCurrentPassword } from "@/server/services/account";

/** ขั้นแรกของการเปลี่ยนรหัส: รหัสเดิมถูก → หน้าตั้งค่าปลดล็อกช่องรหัสใหม่ (ตอนเปลี่ยนจริงตรวจซ้ำอีกรอบ) */
export const POST = api(async (req) => {
  const user = await requireUser();
  const { currentPassword } = await parseBody(req, verifyPasswordSchema);
  await checkCurrentPassword(user, currentPassword);
  return ok({ verified: true });
});
