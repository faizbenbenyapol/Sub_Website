import { requireUser } from "@/server/auth";
import { api, idParam, noContent } from "@/server/http";
import { markRead } from "@/server/services/notifications";

/** ทำเครื่องหมายว่าอ่านแล้ว */
export const POST = api<RouteContext<"/api/notifications/[id]/read">>(async (_req, ctx) => {
  const user = await requireUser();
  await markRead(user.id, await idParam(ctx.params));
  return noContent();
});
