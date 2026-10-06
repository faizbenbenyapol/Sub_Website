import { requireAdmin } from "@/server/auth";
import { api, ok } from "@/server/http";
import { getAdminDashboard } from "@/server/services/admin-users";

/** สถิติภาพรวมระบบ (US-H5) */
export const GET = api(async () => {
  await requireAdmin();
  return ok(await getAdminDashboard());
});
