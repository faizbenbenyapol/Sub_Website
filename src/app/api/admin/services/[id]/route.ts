import { serviceUpdateSchema } from "@/lib/validation/catalog";
import { requireAdmin } from "@/server/auth";
import { api, idParam, noContent, ok, parseBody } from "@/server/http";
import { deleteService, getServiceAdmin, updateService } from "@/server/services/admin-catalog";

type Ctx = RouteContext<"/api/admin/services/[id]">;

/** รายละเอียดบริการพร้อมแพ็กเกจทั้งหมด (รวมที่ซ่อน) */
export const GET = api<Ctx>(async (_req, ctx) => {
  await requireAdmin();
  return ok(await getServiceAdmin(await idParam(ctx.params)));
});

/** แก้บริการ — ส่ง { isActive: false } เพื่อซ่อน */
export const PATCH = api<Ctx>(async (req, ctx) => {
  await requireAdmin();
  const id = await idParam(ctx.params);
  const input = await parseBody(req, serviceUpdateSchema);
  return ok(await updateService(id, input));
});

/** ลบบริการ — มีผู้ใช้ผูกอยู่ได้ 409 IN_USE พร้อมข้อความแนะนำให้ซ่อน */
export const DELETE = api<Ctx>(async (_req, ctx) => {
  await requireAdmin();
  await deleteService(await idParam(ctx.params));
  return noContent();
});
