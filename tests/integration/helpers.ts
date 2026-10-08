import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, plans, services, userSubscriptions, users, type User } from "@/db/schema";
import { anchorDayOf } from "@/lib/billing";
import { addDays, todayInBangkok } from "@/lib/dates";
import { SESSION_COOKIE, signSession } from "@/lib/session-token";

// helper ของเทส integration: เรียก route handler ตรง ๆ + สร้างข้อมูลทดสอบ (docs/04-test-plan.md ข้อ 2)

export const ORIGIN = "http://localhost:3000";
export const PASSWORD = "password-123";
// cost ต่ำสุดให้เทสเร็ว — bcrypt.compare อ่าน cost จาก hash เอง
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export type CallOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** ผู้ใช้ที่ล็อกอิน — สร้าง cookie session ที่เซ็นจริง */
  as?: Pick<User, "id" | "role"> & { sessionVersion?: number };
  /** token ดิบ (เช่น token ปลอม) แทน as */
  token?: string;
  /** cookie อื่นนอกจาก session เช่น g_oauth */
  cookies?: Record<string, string>;
  params?: Record<string, string>;
  /** null = ไม่ส่ง Origin, string = ส่ง origin นั้น (ค่าเริ่มต้นส่ง origin ของแอปเมื่อไม่ใช่ GET) */
  origin?: string | null;
  headers?: Record<string, string>;
};

export type CallResult = {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- เทสตรวจรูป JSON เอง
  json: any;
  res: Response;
};

/** เรียก route handler เหมือน Next เรียก แล้วคืน status + JSON */
export async function call(handler: unknown, path: string, opts: CallOptions = {}): Promise<CallResult> {
  const method = opts.method ?? "GET";
  const headers = new Headers({ host: "localhost:3000", ...opts.headers });
  const origin = opts.origin === undefined ? (method === "GET" ? null : ORIGIN) : opts.origin;
  if (origin) headers.set("origin", origin);
  if (opts.body !== undefined) headers.set("content-type", "application/json");

  const jar = new Map<string, string>();
  if (opts.as) {
    jar.set(
      SESSION_COOKIE,
      await signSession({ userId: opts.as.id, role: opts.as.role, sv: opts.as.sessionVersion ?? 0 }),
    );
  }
  if (opts.token !== undefined) jar.set(SESSION_COOKIE, opts.token);
  for (const [k, v] of Object.entries(opts.cookies ?? {})) jar.set(k, v);
  (globalThis as { __testCookies?: Map<string, string> }).__testCookies = jar;

  const req = new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const res = await (handler as Handler)(req, { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.clone().text();
  const isJson = res.headers.get("content-type")?.includes("application/json");
  return { status: res.status, json: text && isJson ? JSON.parse(text) : null, res };
}

let seq = 0;
/** ค่าไม่ซ้ำในเทสเดียวกัน */
export const uniq = (prefix: string) => `${prefix}-${++seq}`;

/** สร้างผู้ใช้ (รหัสผ่าน = PASSWORD) */
export async function makeUser(over: Partial<typeof users.$inferInsert> = {}): Promise<User> {
  const [{ id }] = await db
    .insert(users)
    .values({ name: "ผู้ทดสอบ", email: `${uniq("user")}@test.local`, passwordHash: PASSWORD_HASH, ...over })
    .$returningId();
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export const makeAdmin = (over: Partial<typeof users.$inferInsert> = {}) =>
  makeUser({ role: "admin", ...over });

/** หมวด + บริการ + แพ็กเกจ รายเดือน ฿419 / รายปี ฿4,190 / ครอบครัว ฿599 (4 คน) */
export async function makeCatalog(over: { serviceActive?: boolean; serviceName?: string } = {}) {
  const slug = uniq("cat");
  const [{ id: categoryId }] = await db
    .insert(categories)
    .values({ name: `หมวด ${slug}`, slug })
    .$returningId();
  const serviceSlug = uniq("svc");
  const [{ id: serviceId }] = await db
    .insert(services)
    .values({
      categoryId,
      name: over.serviceName ?? `บริการ ${serviceSlug}`,
      slug: serviceSlug,
      cancelSteps: "เข้าเมนูบัญชี\nกดยกเลิก",
      isActive: over.serviceActive ?? true,
    })
    .$returningId();
  const planRows = [
    { serviceId, name: "รายเดือน", price: "419.00", billingCycle: "monthly" as const, maxMembers: 1 },
    { serviceId, name: "รายปี", price: "4190.00", billingCycle: "yearly" as const, maxMembers: 1 },
    { serviceId, name: "ครอบครัว", price: "599.00", billingCycle: "monthly" as const, maxMembers: 4 },
  ];
  const ids = [];
  for (const p of planRows) ids.push((await db.insert(plans).values(p).$returningId())[0].id);
  return {
    categoryId,
    categorySlug: slug,
    serviceId,
    serviceSlug,
    monthlyPlanId: ids[0],
    yearlyPlanId: ids[1],
    familyPlanId: ids[2],
  };
}

/** วันที่ไทยนับจากวันนี้ */
export const daysFromToday = (n: number) => addDays(todayInBangkok(), n);

/** ใส่ subscription ตรงลง DB (ข้าม validation — ใช้เตรียมข้อมูล) */
export async function makeSub(
  userId: number,
  over: Partial<typeof userSubscriptions.$inferInsert> & { categoryId?: number } = {},
) {
  const { categoryId, ...rest } = over;
  const nextBillingDate = rest.nextBillingDate ?? daysFromToday(10);
  const [{ id }] = await db
    .insert(userSubscriptions)
    .values({
      userId,
      price: "100.00",
      billingCycle: "monthly",
      billingAnchorDay: anchorDayOf(nextBillingDate),
      ...(rest.planId ? {} : { customName: "รายการเอง", customCategoryId: categoryId }),
      ...rest,
      nextBillingDate,
    })
    .$returningId();
  return id;
}
