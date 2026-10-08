import { requireUser } from "@/server/auth";
import { api, ok } from "@/server/http";
import { getSavings } from "@/server/services/savings";

/** ข้อเสนอประหยัดจากแพ็กเกจในคลัง (US-G1) */
export const GET = api(async () => {
  const user = await requireUser();
  return ok(await getSavings(user.id));
});
