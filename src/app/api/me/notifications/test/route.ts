import { todayInBangkok } from "@/lib/dates";
import { requireUser } from "@/server/auth";
import { api, ApiError, ok } from "@/server/http";
import { hit } from "@/server/rate-limit";
import { sendTestEmail } from "@/server/services/notifications";

/** ส่งอีเมลทดสอบทันทีโดยไม่ต้องรอ 08:00 (US-E4) — จำกัด 1 ครั้งต่อนาที */
export const POST = api(async () => {
  const user = await requireUser();
  if (!hit(`test-email:${user.id}`, 1, 60_000)) {
    throw new ApiError(429, "RATE_LIMITED", "เพิ่งส่งไปเมื่อสักครู่ รอ 1 นาทีแล้วลองใหม่");
  }
  if (!hit(`test-email-day:${user.id}`, 10, 24 * 60 * 60 * 1000)) {
    throw new ApiError(429, "RATE_LIMITED", "วันนี้ส่งอีเมลทดสอบครบ 10 ครั้งแล้ว ลองพรุ่งนี้");
  }
  return ok(await sendTestEmail(user, todayInBangkok()));
});
