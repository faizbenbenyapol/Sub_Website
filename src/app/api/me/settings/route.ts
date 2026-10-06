import { z } from "@/lib/validation";
import { requireUser } from "@/server/auth";
import { api, ok, parseBody } from "@/server/http";
import { settingsOf, updateSettings } from "@/server/services/notifications";

const settingsSchema = z.object({
  notifyEnabled: z.boolean().optional(),
  notifyDaysBefore: z
    .union([z.literal(1), z.literal(3), z.literal(7)], { error: "เลือกได้ 1, 3 หรือ 7 วัน" })
    .optional(),
});

/** การตั้งค่าแจ้งเตือนของฉัน */
export const GET = api(async () => ok(settingsOf(await requireUser())));

/** เปิด/ปิดแจ้งเตือน และจำนวนวันล่วงหน้า (US-E1) */
export const PATCH = api(async (req) => {
  const user = await requireUser();
  return ok(await updateSettings(user.id, await parseBody(req, settingsSchema)));
});
