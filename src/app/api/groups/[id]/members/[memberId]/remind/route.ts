import { requireUser } from "@/server/auth";
import { api, idParam, noContent } from "@/server/http";
import { remindMember } from "@/server/services/groups";

/** ส่งอีเมลเตือนสมาชิกที่ยังไม่จ่าย (วันละครั้งต่อคน) */
export const POST = api<RouteContext<"/api/groups/[id]/members/[memberId]/remind">>(async (_req, ctx) => {
  const user = await requireUser();
  await remindMember(user.id, await idParam(ctx.params), await idParam(ctx.params, "memberId"));
  return noContent();
});
