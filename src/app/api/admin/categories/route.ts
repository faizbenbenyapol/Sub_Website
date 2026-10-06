import { categoryCreateSchema } from "@/lib/validation/catalog";
import { requireAdmin } from "@/server/auth";
import { api, ok, parseBody } from "@/server/http";
import { createCategory, listCategoriesAdmin } from "@/server/services/admin-catalog";

/** หมวดทั้งหมดพร้อมจำนวนบริการ */
export const GET = api(async () => {
  await requireAdmin();
  return ok(await listCategoriesAdmin());
});

/** สร้างหมวดใหม่ */
export const POST = api(async (req) => {
  await requireAdmin();
  const input = await parseBody(req, categoryCreateSchema);
  return ok(await createCategory(input), { status: 201 });
});
