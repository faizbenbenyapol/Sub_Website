import { groupCreateSchema } from "@/lib/validation/group";
import { requireUser } from "@/server/auth";
import { api, ok, parseBody } from "@/server/http";
import { createGroup, listGroups } from "@/server/services/groups";

/** กลุ่มหารทั้งหมดของฉัน */
export const GET = api(async () => {
  const user = await requireUser();
  return ok(await listGroups(user.id));
});

/** สร้างกลุ่มหาร (US-F1) */
export const POST = api(async (req) => {
  const user = await requireUser();
  return ok(await createGroup(user.id, await parseBody(req, groupCreateSchema)), { status: 201 });
});
