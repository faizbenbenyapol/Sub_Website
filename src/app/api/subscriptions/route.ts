import { subscriptionCreateSchema } from "@/lib/validation/subscription";
import { requireUser } from "@/server/auth";
import { api, ApiError, ok, parseBody, queryParam } from "@/server/http";
import { createSubscription, listSubscriptions } from "@/server/services/subscriptions";

const STATUSES = ["active", "cancelled", "all"] as const;

/** รายการของฉัน — ?status=active|cancelled|all (ค่าเริ่มต้น active) */
export const GET = api(async (req) => {
  const user = await requireUser();
  const status = queryParam(req, "status") ?? "active";
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    throw new ApiError(400, "VALIDATION_ERROR", "status ต้องเป็น active, cancelled หรือ all");
  }
  return ok(await listSubscriptions(user.id, status as (typeof STATUSES)[number]));
});

/** เพิ่มรายการจากคลัง (source: catalog) หรือเพิ่มเอง (source: custom) */
export const POST = api(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, subscriptionCreateSchema);
  return ok(await createSubscription(user.id, input), { status: 201 });
});
