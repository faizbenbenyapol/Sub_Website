import { serviceCreateSchema } from "@/lib/validation/catalog";
import { requireAdmin } from "@/server/auth";
import { api, ok, parseBody, queryParam } from "@/server/http";
import { createService, listServicesAdmin } from "@/server/services/admin-catalog";

/** บริการทั้งหมดรวมที่ซ่อน — ค้นด้วย ?q= และกรองด้วย ?category=slug */
export const GET = api(async (req) => {
  await requireAdmin();
  return ok(await listServicesAdmin({ q: queryParam(req, "q"), category: queryParam(req, "category") }));
});

/** สร้างบริการใหม่ (เพิ่มแพ็กเกจทีหลังที่ /plans) */
export const POST = api(async (req) => {
  await requireAdmin();
  const input = await parseBody(req, serviceCreateSchema);
  return ok(await createService(input), { status: 201 });
});
