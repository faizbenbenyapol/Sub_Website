import { planUpdateSchema } from "@/lib/validation/catalog";
import { requireAdmin } from "@/server/auth";
import { api, idParam, noContent, ok, parseBody } from "@/server/http";
import { deletePlan, updatePlan } from "@/server/services/admin-catalog";

type Ctx = RouteContext<"/api/admin/plans/[id]">;

/** แก้แพ็กเกจ — ราคาเปลี่ยนแล้วบันทึกประวัติราคาให้อัตโนมัติ */
export const PATCH = api<Ctx>(async (req, ctx) => {
  const admin = await requireAdmin();
  const id = await idParam(ctx.params);
  const input = await parseBody(req, planUpdateSchema);
  return ok(await updatePlan(id, input, admin.id));
});

/** ลบแพ็กเกจ — มีผู้ใช้ผูกอยู่ได้ 409 IN_USE */
export const DELETE = api<Ctx>(async (_req, ctx) => {
  await requireAdmin();
  await deletePlan(await idParam(ctx.params));
  return noContent();
});
