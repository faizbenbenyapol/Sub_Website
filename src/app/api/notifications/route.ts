import { requireUser } from "@/server/auth";
import { api, queryParam } from "@/server/http";
import { listNotifications } from "@/server/services/notifications";

/** การแจ้งเตือนในเว็บ ?unread=1 &limit=20 — meta.unreadCount ใช้ทำตัวเลขบนกระดิ่ง (US-E3) */
export const GET = api(async (req) => {
  const user = await requireUser();
  const { data, unreadCount } = await listNotifications(user.id, {
    unreadOnly: queryParam(req, "unread") === "1",
    limit: Number(queryParam(req, "limit") ?? 20) || 20,
  });
  return Response.json({ data, meta: { unreadCount } });
});
