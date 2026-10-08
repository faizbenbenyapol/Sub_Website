import { clearSession, revokeSessions } from "@/server/auth";
import { api, noContent } from "@/server/http";

/** ออกจากระบบ — ยกเลิก token ทุกใบของผู้ใช้ (token ที่หลุดไปก็ใช้ไม่ได้) แล้วลบ cookie · เรียกได้แม้ session หมดอายุแล้ว */
export const POST = api(async () => {
  await revokeSessions();
  return clearSession(noContent());
});
