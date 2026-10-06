import { z } from "@/lib/validation";
import { requireAdmin } from "@/server/auth";
import { api, idParam, ok, parseBody } from "@/server/http";
import { setUserStatus } from "@/server/services/admin-users";

const statusSchema = z.object({
  status: z.enum(["active", "suspended"], { error: "status ต้องเป็น active หรือ suspended" }),
});

/** ระงับ/เปิดใช้งานบัญชีผู้ใช้ — ระงับแล้วมีผลทันทีเพราะทุก API โหลดผู้ใช้จาก DB */
export const PATCH = api<RouteContext<"/api/admin/users/[id]">>(async (req, ctx) => {
  const admin = await requireAdmin();
  const id = await idParam(ctx.params);
  const { status } = await parseBody(req, statusSchema);
  return ok(await setUserStatus(admin.id, id, status));
});
