import { feedbackStatuses } from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { api, queryParam } from "@/server/http";
import { listFeedback } from "@/server/services/feedback";

/** รายการแจ้งปัญหา / คำแนะนำทั้งหมด ?status= คั่นด้วยจุลภาคได้ เช่น acknowledged,in_progress &page= */
export const GET = api(async (req) => {
  await requireAdmin();
  const wanted = (queryParam(req, "status") ?? "").split(",");
  const result = await listFeedback({
    statuses: feedbackStatuses.filter((s) => wanted.includes(s)),
    page: Number(queryParam(req, "page") ?? 1) || 1,
  });
  return Response.json(result);
});
