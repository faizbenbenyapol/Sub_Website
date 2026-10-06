import { requireAdmin } from "@/server/auth";
import { api, queryParam } from "@/server/http";
import { listUsers } from "@/server/services/admin-users";

/** รายชื่อผู้ใช้ ?q= &page= (US-H4) — เฉพาะข้อมูลบัญชี */
export const GET = api(async (req) => {
  await requireAdmin();
  const result = await listUsers({
    q: queryParam(req, "q"),
    page: Number(queryParam(req, "page") ?? 1) || 1,
  });
  return Response.json(result);
});
