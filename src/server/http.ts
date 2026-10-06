import "server-only";
import { NextResponse } from "next/server";
import { fieldErrors, type z } from "@/lib/validation";

// รูปแบบ response เดียวทั้งระบบ (docs/02-architecture.md ข้อ 5.1)

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "ACCOUNT_SUSPENDED"
  | "NOT_FOUND"
  | "EMAIL_TAKEN"
  | "IN_USE"
  | "GROUP_EXISTS"
  | "RATE_LIMITED"
  | "EMAIL_FAILED"
  | "INTERNAL_ERROR";

/** error ที่ตั้งใจโยนจาก service/handler แล้วให้ api() แปลงเป็น response */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/** response สำเร็จ { data } */
export function ok<T>(data: T, init?: { status?: number }) {
  return NextResponse.json({ data }, { status: init?.status ?? 200 });
}

/** response ไม่มี body (ลบสำเร็จ / logout) */
export function noContent() {
  return new NextResponse(null, { status: 204 });
}

/** response error รูปแบบเดียวกันทั้งระบบ */
export function fail(status: number, code: ErrorCode, message: string, fields?: Record<string, string>) {
  return NextResponse.json({ error: { code, message, ...(fields && { fields }) } }, { status });
}

/**
 * ตรวจว่า request ที่แก้ข้อมูลมาจากหน้าเว็บเราเอง (กัน CSRF ร่วมกับ cookie sameSite=lax)
 * เทียบ host ของ Origin กับ Host ของ request เพื่อให้ใช้ได้ทั้ง localhost และ IP ในวง LAN ตอน demo บนมือถือ
 */
function assertSameOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    throw new ApiError(403, "FORBIDDEN", "คำขอนี้ไม่ได้มาจากหน้าเว็บของระบบ");
  }
}

/** อ่าน JSON body แล้ว validate ด้วย zod — ผิดรูปแบบโยน 400 พร้อม fields */
export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError(400, "VALIDATION_ERROR", "ต้องส่งข้อมูลเป็น JSON");
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "ข้อมูล JSON ไม่ถูกต้อง");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "กรุณาตรวจสอบข้อมูล", fieldErrors(parsed.error));
  }
  return parsed.data;
}

/**
 * ห่อ route handler: ตรวจ origin, แปลง ApiError เป็น response, และซ่อนรายละเอียดของ error ที่ไม่ได้ตั้งใจ
 * ใช้: export const POST = api(async (req, ctx) => ok(...))
 */
export function api<Ctx = unknown>(handler: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) return fail(err.status, err.code, err.message, err.fields);
      console.error(`[api] ${req.method} ${new URL(req.url).pathname}`, err);
      return fail(500, "INTERNAL_ERROR", "เกิดข้อผิดพลาดในระบบ ลองใหม่อีกครั้ง");
    }
  };
}

/** อ่าน id ตัวเลขจาก dynamic segment — ไม่ใช่จำนวนเต็มบวกถือว่าไม่พบ (404) */
export async function idParam(params: Promise<Record<string, string>>, key = "id"): Promise<number> {
  const raw = (await params)[key];
  const id = Number(raw);
  if (!/^\d+$/.test(raw ?? "") || !Number.isSafeInteger(id) || id <= 0) {
    throw new ApiError(404, "NOT_FOUND", "ไม่พบข้อมูลที่ต้องการ");
  }
  return id;
}

/** อ่าน query string แบบ optional (ค่าว่างถือว่าไม่ได้ส่ง) */
export function queryParam(req: Request, key: string): string | undefined {
  const value = new URL(req.url).searchParams.get(key)?.trim();
  return value ? value : undefined;
}
