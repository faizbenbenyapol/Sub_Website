import { clearSession } from "@/server/auth";
import { api, noContent } from "@/server/http";

/** ออกจากระบบ — ลบ cookie (เรียกได้แม้ session หมดอายุแล้ว) */
export const POST = api(async () => clearSession(noContent()));
