import { feedbackCreateSchema } from "@/lib/validation/feedback";
import { requireUser } from "@/server/auth";
import { api, ApiError, ok, parseBody } from "@/server/http";
import { hit } from "@/server/rate-limit";
import { createFeedback } from "@/server/services/feedback";

const MAX_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

/** ส่งรายงานปัญหา / คำแนะนำถึงผู้พัฒนา — จำกัด 5 ครั้งต่อชั่วโมงต่อบัญชี กันกดรัว/สแปม */
export const POST = api(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, feedbackCreateSchema);
  if (!hit(`feedback:${user.id}`, MAX_PER_HOUR, HOUR_MS)) {
    throw new ApiError(429, "RATE_LIMITED", "ส่งบ่อยเกินไป รอสักชั่วโมงแล้วส่งใหม่ได้");
  }
  return ok(await createFeedback(user.id, input), { status: 201 });
});
