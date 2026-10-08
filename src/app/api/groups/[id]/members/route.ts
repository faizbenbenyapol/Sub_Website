import { memberSchema } from "@/lib/validation/group";
import { requireUser } from "@/server/auth";
import { api, idParam, ok, parseBody } from "@/server/http";
import { addMember } from "@/server/services/groups";

/** เพิ่มสมาชิก (โหมดหารเท่ากันคำนวณยอดใหม่ทุกคน) */
export const POST = api<RouteContext<"/api/groups/[id]/members">>(async (req, ctx) => {
  const user = await requireUser();
  const id = await idParam(ctx.params);
  return ok(await addMember(user.id, id, await parseBody(req, memberSchema)), { status: 201 });
});
