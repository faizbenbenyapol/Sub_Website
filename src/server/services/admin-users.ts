import "server-only";
import { and, count, desc, eq, gte, like, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { db } from "@/db";
import { categories, notifications, plans, services, userSubscriptions, users } from "@/db/schema";
import { monthlySatang } from "@/lib/billing";
import { addDays, todayInBangkok } from "@/lib/dates";
import { containsPattern } from "@/lib/like";
import { fromSatang, toSatang } from "@/lib/money";
import { ApiError } from "../http";

// หลังบ้าน: จัดการผู้ใช้ (US-H4) และสถิติภาพรวม (US-H5) — เรียกจาก route ที่ผ่าน requireAdmin() แล้วเท่านั้น
// US-H4: admin เห็นเฉพาะข้อมูลบัญชี ไม่เห็นรายการ subscription ส่วนตัวของผู้ใช้

export const USERS_PAGE_SIZE = 20;

export type AdminUserDto = {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "suspended";
  loginMethods: ("email" | "google")[]; // ไม่ส่ง hash หรือ id ของ Google ออกไป บอกแค่ว่าเข้าทางไหนได้
  createdAt: string;
};

const accountColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  status: users.status,
  createdAt: users.createdAt,
  // เลือกแค่ "มีหรือไม่มี" ใน SQL — hash และ id ของ Google ไม่ออกจากฐานข้อมูลเลย
  hasPassword: sql<number>`${users.passwordHash} is not null`,
  hasGoogle: sql<number>`${users.googleSub} is not null`,
};

type AccountRow = { hasPassword: number; hasGoogle: number; createdAt: Date } & Omit<
  AdminUserDto,
  "loginMethods" | "createdAt"
>;

/** แถวจาก DB → DTO (บอกแค่ช่องทางเข้าสู่ระบบ) */
function toAdminUserDto({ hasPassword, hasGoogle, createdAt, ...r }: AccountRow): AdminUserDto {
  const loginMethods: AdminUserDto["loginMethods"] = [];
  if (Number(hasPassword)) loginMethods.push("email");
  if (Number(hasGoogle)) loginMethods.push("google");
  return { ...r, loginMethods, createdAt: createdAt.toISOString() };
}

/** รายชื่อผู้ใช้ ค้นจากชื่อ/อีเมล แบ่งหน้า (ใหม่ → เก่า) */
export async function listUsers(opts: { q?: string; page?: number }) {
  const q = opts.q?.trim();
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const where = q
    ? or(like(users.name, containsPattern(q)), like(users.email, containsPattern(q)))
    : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select(accountColumns)
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(USERS_PAGE_SIZE)
      .offset((page - 1) * USERS_PAGE_SIZE),
    db.select({ total: count() }).from(users).where(where),
  ]);
  const data = rows.map(toAdminUserDto);
  return { data, meta: { page, pageSize: USERS_PAGE_SIZE, total } };
}

/** ระงับ/เปิดใช้งานบัญชี — แตะบัญชีตัวเองหรือ admin คนอื่นไม่ได้ */
export async function setUserStatus(adminId: number, userId: number, status: "active" | "suspended") {
  const [target] = await db.select(accountColumns).from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new ApiError(404, "NOT_FOUND", "ไม่พบผู้ใช้นี้");
  if (target.id === adminId) throw new ApiError(400, "VALIDATION_ERROR", "ระงับบัญชีตัวเองไม่ได้");
  if (target.role === "admin")
    throw new ApiError(400, "VALIDATION_ERROR", "เปลี่ยนสถานะบัญชีผู้ดูแลระบบไม่ได้");
  await db.update(users).set({ status }).where(eq(users.id, userId));
  return toAdminUserDto({ ...target, status });
}

export type AdminDashboardDto = {
  totals: { users: number; activeSubscriptions: number; avgMonthlyPerUser: number; emailsThisMonth: number };
  topServices: { serviceId: number; name: string; count: number }[];
  byCategory: { categoryId: number; name: string; count: number }[];
  newUsersDaily: { date: string; count: number }[];
};

const serviceCategory = alias(categories, "service_category");
const customCategory = alias(categories, "custom_category");

/** สถิติภาพรวมระบบ (US-H5) */
export async function getAdminDashboard(now = new Date()): Promise<AdminDashboardDto> {
  const today = todayInBangkok(now);
  const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00+07:00`);
  const since = addDays(today, -29);

  const [[{ userCount }], active, [{ emails }], recentUsers] = await Promise.all([
    db.select({ userCount: count() }).from(users).where(eq(users.role, "user")),
    db
      .select({
        userId: userSubscriptions.userId,
        price: userSubscriptions.price,
        cycle: userSubscriptions.billingCycle,
        serviceId: services.id,
        serviceName: services.name,
        serviceCategory,
        customCategory,
      })
      .from(userSubscriptions)
      .leftJoin(plans, eq(userSubscriptions.planId, plans.id))
      .leftJoin(services, eq(plans.serviceId, services.id))
      .leftJoin(serviceCategory, eq(services.categoryId, serviceCategory.id))
      .leftJoin(customCategory, eq(userSubscriptions.customCategoryId, customCategory.id))
      .where(eq(userSubscriptions.status, "active")),
    db
      .select({ emails: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.channel, "email"),
          eq(notifications.status, "sent"),
          gte(notifications.createdAt, monthStart),
        ),
      ),
    db
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(and(eq(users.role, "user"), gte(users.createdAt, new Date(`${since}T00:00:00+07:00`)))),
  ]);

  // ค่าเฉลี่ยต่อผู้ใช้: หารด้วยผู้ใช้ที่มีรายการ active อย่างน้อย 1 รายการเท่านั้น (H5-1)
  const payingUsers = new Set(active.map((a) => a.userId));
  const monthlyTotal = active.reduce((s, a) => s + monthlySatang(toSatang(a.price), a.cycle), 0);

  const tally = <K>(entries: [K, string][]) => {
    const map = new Map<K, { name: string; count: number }>();
    for (const [key, name] of entries) {
      const e = map.get(key) ?? { name, count: 0 };
      e.count++;
      map.set(key, e);
    }
    return [...map.entries()].sort(
      (a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name, "th"),
    );
  };

  const perDay = new Map<string, number>();
  for (const u of recentUsers) {
    const d = todayInBangkok(u.createdAt);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }

  return {
    totals: {
      users: userCount,
      activeSubscriptions: active.length,
      avgMonthlyPerUser: payingUsers.size ? fromSatang(Math.round(monthlyTotal / payingUsers.size)) : 0,
      emailsThisMonth: emails,
    },
    topServices: tally(
      active
        .filter((a) => a.serviceId !== null)
        .map((a) => [a.serviceId!, a.serviceName!] as [number, string]),
    )
      .slice(0, 10)
      .map(([serviceId, v]) => ({ serviceId, ...v })),
    byCategory: tally(
      active.map((a) => {
        const c = (a.serviceCategory ?? a.customCategory)!;
        return [c.id, c.name] as [number, string];
      }),
    ).map(([categoryId, v]) => ({ categoryId, ...v })),
    // ครบ 30 จุด เติม 0 วันที่ไม่มีผู้ใช้ใหม่ (H5-2)
    newUsersDaily: Array.from({ length: 30 }, (_, i) => {
      const date = addDays(since, i);
      return { date, count: perDay.get(date) ?? 0 };
    }),
  };
}
