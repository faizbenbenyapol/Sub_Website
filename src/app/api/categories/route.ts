import { api, ok } from "@/server/http";
import { listCategories } from "@/server/services/catalog";

/** หมวดทั้งหมด (public) เรียงตามลำดับที่ admin ตั้ง */
export const GET = api(async () => ok(await listCategories()));
