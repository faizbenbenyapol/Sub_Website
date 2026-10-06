import { categoryUpdateSchema } from "@/lib/validation/catalog";
import { requireAdmin } from "@/server/auth";
import { api, idParam, noContent, ok, parseBody } from "@/server/http";
import { deleteCategory, updateCategory } from "@/server/services/admin-catalog";

type Ctx = RouteContext<"/api/admin/categories/[id]">;

/** แก้หมวด */
export const PATCH = api<Ctx>(async (req, ctx) => {
  await requireAdmin();
  const id = await idParam(ctx.params);
  const input = await parseBody(req, categoryUpdateSchema);
  return ok(await updateCategory(id, input));
});

/** ลบหมวด — มีบริการอยู่ได้ 409 IN_USE */
export const DELETE = api<Ctx>(async (_req, ctx) => {
  await requireAdmin();
  await deleteCategory(await idParam(ctx.params));
  return noContent();
});
