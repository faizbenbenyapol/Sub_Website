import { z } from "@/lib/validation";
import { requireAdmin } from "@/server/auth";
import { api, idParam, noContent, ok, parseBody } from "@/server/http";
import { deleteUser, setUserRole, setUserStatus } from "@/server/services/admin-users";

const updateSchema = z
  .object({
    status: z.enum(["active", "suspended"], { error: "status ต้องเป็น active หรือ suspended" }).optional(),
    role: z.enum(["user", "admin"], { error: "role ต้องเป็น user หรือ admin" }).optional(),
  })
  .refine((v) => (v.status === undefined) !== (v.role === undefined), {
    error: "ส่ง status หรือ role อย่างใดอย่างหนึ่ง",
    path: ["status"],
  });

/**
 * ระงับ/เปิดใช้งาน หรือเปลี่ยนสิทธิ์ (user ↔ admin) — ทีละอย่างต่อคำขอ
 * ระงับแล้วมีผลทันทีเพราะทุก API โหลดผู้ใช้จาก DB · เปลี่ยนสิทธิ์แล้วคนนั้นต้องล็อกอินใหม่
 */
export const PATCH = api<RouteContext<"/api/admin/users/[id]">>(async (req, ctx) => {
  const admin = await requireAdmin();
  const id = await idParam(ctx.params);
  const body = await parseBody(req, updateSchema);
  if (body.role) return ok(await setUserRole(admin.id, id, body.role));
  return ok(await setUserStatus(admin.id, id, body.status!));
});

/** ลบบัญชีถาวร (ข้อมูลของคนนั้นหายตาม) — ลบตัวเองหรือผู้ดูแลระบบไม่ได้ */
export const DELETE = api<RouteContext<"/api/admin/users/[id]">>(async (_req, ctx) => {
  const admin = await requireAdmin();
  await deleteUser(admin.id, await idParam(ctx.params));
  return noContent();
});
