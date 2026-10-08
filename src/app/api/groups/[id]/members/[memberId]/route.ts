import { memberUpdateSchema } from "@/lib/validation/group";
import { requireUser } from "@/server/auth";
import { api, idParam, ok, parseBody } from "@/server/http";
import { removeMember, updateMember } from "@/server/services/groups";

type Ctx = RouteContext<"/api/groups/[id]/members/[memberId]">;

/** แก้ชื่อ/อีเมล/ยอดของสมาชิก */
export const PATCH = api<Ctx>(async (req, ctx) => {
  const user = await requireUser();
  const [id, memberId] = [await idParam(ctx.params), await idParam(ctx.params, "memberId")];
  return ok(await updateMember(user.id, id, memberId, await parseBody(req, memberUpdateSchema)));
});

/** ลบสมาชิก — ลิงก์จ่ายเงินเดิมใช้ไม่ได้ทันที */
export const DELETE = api<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  const [id, memberId] = [await idParam(ctx.params), await idParam(ctx.params, "memberId")];
  return ok(await removeMember(user.id, id, memberId));
});
