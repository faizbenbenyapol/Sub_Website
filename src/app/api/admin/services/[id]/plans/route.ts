import { planCreateSchema } from "@/lib/validation/catalog";
import { requireAdmin } from "@/server/auth";
import { api, idParam, ok, parseBody } from "@/server/http";
import { createPlan } from "@/server/services/admin-catalog";

/** เพิ่มแพ็กเกจให้บริการ */
export const POST = api<RouteContext<"/api/admin/services/[id]/plans">>(async (req, ctx) => {
  await requireAdmin();
  const serviceId = await idParam(ctx.params);
  const input = await parseBody(req, planCreateSchema);
  return ok(await createPlan(serviceId, input), { status: 201 });
});
