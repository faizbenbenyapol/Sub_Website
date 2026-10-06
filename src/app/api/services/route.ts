import { api, ok, queryParam } from "@/server/http";
import { listServicesPublic } from "@/server/services/catalog";

/** คลังบริการ (public) — ?q= ค้นชื่อ, ?category= slug ของหมวด (US-B1) */
export const GET = api(async (req) =>
  ok(await listServicesPublic({ q: queryParam(req, "q"), category: queryParam(req, "category") })),
);
