import { timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";
import { api, ApiError, ok } from "@/server/http";
import { runReminders } from "@/server/services/reminders";

/** เทียบ secret แบบเวลาคงที่ กันการเดาทีละตัวอักษรจากเวลาตอบ */
function validSecret(header: string | null): boolean {
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * รันงานแจ้งเตือนรายวัน (ADR-004) — เรียกจาก cron ใน instrumentation.ts หรือ scheduler ภายนอก
 * ต้องส่ง Authorization: Bearer $CRON_SECRET
 */
export const POST = api(
  async (req) => {
    if (!validSecret(req.headers.get("authorization"))) {
      throw new ApiError(401, "UNAUTHENTICATED", "CRON_SECRET ไม่ถูกต้อง");
    }
    return ok(await runReminders());
  },
  { allowCrossOrigin: true },
);
