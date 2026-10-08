import { groupUpdateSchema, periodSchema } from "@/lib/validation/group";
import { requireUser } from "@/server/auth";
import { api, ApiError, idParam, noContent, ok, parseBody, queryParam } from "@/server/http";
import { currentPeriod, deleteGroup, getGroup, updateGroup } from "@/server/services/groups";

type Ctx = RouteContext<"/api/groups/[id]">;

/** กลุ่มเดียวพร้อมสถานะการจ่ายของรอบ ?period=YYYY-MM (ค่าเริ่มต้นเดือนนี้) */
export const GET = api<Ctx>(async (req, ctx) => {
  const user = await requireUser();
  const period = periodSchema.safeParse(queryParam(req, "period") ?? currentPeriod());
  if (!period.success) throw new ApiError(400, "VALIDATION_ERROR", "period ต้องอยู่ในรูปแบบ YYYY-MM");
  return ok(await getGroup(user.id, await idParam(ctx.params), period.data));
});

/** แก้ชื่อ / PromptPay ID / โหมดการหาร */
export const PATCH = api<Ctx>(async (req, ctx) => {
  const user = await requireUser();
  const id = await idParam(ctx.params);
  return ok(await updateGroup(user.id, id, await parseBody(req, groupUpdateSchema)));
});

/** ลบกลุ่ม */
export const DELETE = api<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  await deleteGroup(user.id, await idParam(ctx.params));
  return noContent();
});
