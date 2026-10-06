import { api, ApiError, ok } from "@/server/http";
import { getServiceBySlug } from "@/server/services/catalog";

/** รายละเอียดบริการ + แพ็กเกจ + วิธียกเลิก (public, US-B2) */
export const GET = api<RouteContext<"/api/services/[slug]">>(async (_req, ctx) => {
  const service = await getServiceBySlug((await ctx.params).slug);
  if (!service) throw new ApiError(404, "NOT_FOUND", "ไม่พบบริการนี้");
  return ok(service);
});
