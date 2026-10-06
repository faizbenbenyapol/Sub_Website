import { todayInBangkok } from "@/lib/dates";
import { requireUser } from "@/server/auth";
import { api, ok } from "@/server/http";
import { getDashboard } from "@/server/services/dashboard";

/** ภาพรวมค่าใช้จ่ายของฉัน (US-D1) */
export const GET = api(async () => {
  const user = await requireUser();
  return ok(await getDashboard(user.id, todayInBangkok()));
});
