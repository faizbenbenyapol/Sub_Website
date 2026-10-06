import { todayInBangkok } from "@/lib/dates";
import { requireUser } from "@/server/auth";
import { api, ApiError, ok, queryParam } from "@/server/http";
import { getCalendar } from "@/server/services/dashboard";

/** ปฏิทินวันตัดเงิน ?month=YYYY-MM (ค่าเริ่มต้นเดือนนี้, US-D2) */
export const GET = api(async (req) => {
  const user = await requireUser();
  const today = todayInBangkok();
  const month = queryParam(req, "month") ?? today.slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new ApiError(400, "VALIDATION_ERROR", "month ต้องอยู่ในรูปแบบ YYYY-MM");
  }
  return ok(await getCalendar(user.id, month, today));
});
