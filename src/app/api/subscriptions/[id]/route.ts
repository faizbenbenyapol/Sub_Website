import { subscriptionUpdateSchema } from "@/lib/validation/subscription";
import { requireUser } from "@/server/auth";
import { api, idParam, noContent, ok, parseBody } from "@/server/http";
import { deleteSubscription, getSubscription, updateSubscription } from "@/server/services/subscriptions";

type Ctx = RouteContext<"/api/subscriptions/[id]">;

/** รายการเดียวของฉัน */
export const GET = api<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  return ok(await getSubscription(user.id, await idParam(ctx.params)));
});

/** แก้รายการ / ยกเลิก ({ status: "cancelled" }) / กลับมาใช้ ({ status: "active", nextBillingDate }) */
export const PATCH = api<Ctx>(async (req, ctx) => {
  const user = await requireUser();
  const id = await idParam(ctx.params);
  const input = await parseBody(req, subscriptionUpdateSchema);
  return ok(await updateSubscription(user.id, id, input));
});

/** ลบรายการออกจากระบบ */
export const DELETE = api<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  await deleteSubscription(user.id, await idParam(ctx.params));
  return noContent();
});
