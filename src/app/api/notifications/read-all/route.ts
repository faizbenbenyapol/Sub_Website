import { requireUser } from "@/server/auth";
import { api, noContent } from "@/server/http";
import { markAllRead } from "@/server/services/notifications";

/** อ่านทั้งหมด */
export const POST = api(async () => {
  const user = await requireUser();
  await markAllRead(user.id);
  return noContent();
});
