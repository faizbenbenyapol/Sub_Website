import { api, ApiError, idParam, ok } from "@/server/http";
import { getPriceHistory } from "@/server/services/catalog";

/** ประวัติราคาของแพ็กเกจสำหรับกราฟ (public) — จุดเรียงเก่า → ใหม่ */
export const GET = api<RouteContext<"/api/plans/[id]/price-history">>(async (_req, ctx) => {
  const history = await getPriceHistory(await idParam(ctx.params));
  if (!history) throw new ApiError(404, "NOT_FOUND", "ไม่พบแพ็กเกจนี้");
  return ok(history);
});
