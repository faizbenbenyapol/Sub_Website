import { feedbackUpdateSchema } from "@/lib/validation/feedback";
import { requireAdmin } from "@/server/auth";
import { api, idParam, ok, parseBody } from "@/server/http";
import { updateFeedback } from "@/server/services/feedback";

/** เปลี่ยนสถานะ (ใหม่ / อ่านแล้ว / แก้แล้ว) และ/หรือ ตอบกลับผู้ส่ง — ตอบแล้วผู้ส่งได้แจ้งเตือนที่กระดิ่ง */
export const PATCH = api<RouteContext<"/api/admin/feedback/[id]">>(async (req, ctx) => {
  await requireAdmin();
  const id = await idParam(ctx.params);
  return ok(await updateFeedback(id, await parseBody(req, feedbackUpdateSchema)));
});
