import { paymentSchema } from "@/lib/validation/group";
import { requireUser } from "@/server/auth";
import { api, idParam, ok, parseBody } from "@/server/http";
import { setPayment } from "@/server/services/groups";

/** เจ้าของทำเครื่องหมายจ่ายแล้ว/ยังไม่จ่ายรายเดือน (US-F3) */
export const PUT = api<RouteContext<"/api/groups/[id]/payments">>(async (req, ctx) => {
  const user = await requireUser();
  const id = await idParam(ctx.params);
  return ok(await setPayment(user.id, id, await parseBody(req, paymentSchema)));
});
