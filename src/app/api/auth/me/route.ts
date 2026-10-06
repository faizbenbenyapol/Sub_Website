import { requireUser, toPublicUser } from "@/server/auth";
import { api, ok } from "@/server/http";

/** ข้อมูลผู้ใช้ที่ล็อกอินอยู่ */
export const GET = api(async () => ok(toPublicUser(await requireUser())));
