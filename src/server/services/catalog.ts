import "server-only";
import { and, asc, eq, inArray, like } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  plans,
  priceHistory,
  services,
  type Category,
  type Plan,
  type Service,
} from "@/db/schema";
import { decimalToNumber, toSatang } from "@/lib/money";
import { splitSteps } from "@/lib/validation/catalog";

// รูปข้อมูลคลังที่ส่งออก API (docs/02 ข้อ 5.2) + ฟังก์ชันอ่านที่ใช้ร่วมกันทั้งฝั่งผู้ใช้และหลังบ้าน

export type CategoryDto = { id: number; name: string; slug: string; icon: string | null; sortOrder: number };
export type PlanDto = {
  id: number;
  name: string;
  price: number;
  billingCycle: "monthly" | "yearly";
  maxMembers: number;
  isActive: boolean;
};
export type ServiceSummaryDto = {
  id: number;
  slug: string;
  name: string;
  logoUrl: string | null;
  category: CategoryDto;
  startingPrice: number | null;
  startingCycle: "monthly" | "yearly" | null;
};
export type ServiceDetailDto = ServiceSummaryDto & {
  websiteUrl: string | null;
  cancelSteps: string[];
  plans: PlanDto[];
  updatedAt: string;
};
export type PricePointDto = { price: number; from: string };

/** แถว categories → DTO */
export function toCategoryDto(c: Category): CategoryDto {
  return { id: c.id, name: c.name, slug: c.slug, icon: c.icon, sortOrder: c.sortOrder };
}

/** แถว plans → DTO (ราคาเป็น number บาท) */
export function toPlanDto(p: Plan): PlanDto {
  return {
    id: p.id,
    name: p.name,
    price: decimalToNumber(p.price),
    billingCycle: p.billingCycle,
    maxMembers: p.maxMembers,
    isActive: p.isActive,
  };
}

/** ราคาเริ่มต้นที่โชว์บนการ์ด: แพ็กเกจรายเดือนที่ถูกที่สุด ถ้าไม่มีรายเดือนใช้รายปีที่ถูกที่สุด */
export function startingPriceOf(
  servicePlans: Plan[],
): Pick<ServiceSummaryDto, "startingPrice" | "startingCycle"> {
  const active = servicePlans.filter((p) => p.isActive);
  for (const cycle of ["monthly", "yearly"] as const) {
    const cheapest = active
      .filter((p) => p.billingCycle === cycle)
      .sort((a, b) => toSatang(a.price) - toSatang(b.price))[0];
    if (cheapest) return { startingPrice: decimalToNumber(cheapest.price), startingCycle: cycle };
  }
  return { startingPrice: null, startingCycle: null };
}

/** ประกอบ ServiceSummary จากแถวบริการ หมวด และแพ็กเกจของบริการนั้น */
export function toServiceSummaryDto(s: Service, category: Category, servicePlans: Plan[]): ServiceSummaryDto {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    logoUrl: s.logoUrl,
    category: toCategoryDto(category),
    ...startingPriceOf(servicePlans),
  };
}

/** ประกอบ ServiceDetail — includeInactivePlans ใช้ฝั่ง admin เท่านั้น */
export function toServiceDetailDto(
  s: Service,
  category: Category,
  servicePlans: Plan[],
  includeInactivePlans = false,
): ServiceDetailDto {
  const visible = includeInactivePlans ? servicePlans : servicePlans.filter((p) => p.isActive);
  return {
    ...toServiceSummaryDto(s, category, servicePlans),
    websiteUrl: s.websiteUrl,
    cancelSteps: splitSteps(s.cancelSteps),
    plans: visible
      .slice()
      .sort((a, b) => a.billingCycle.localeCompare(b.billingCycle) || toSatang(a.price) - toSatang(b.price))
      .map(toPlanDto),
    updatedAt: s.updatedAt.toISOString(),
  };
}

/** หมวดทั้งหมดเรียงตาม sortOrder */
export async function listCategories(): Promise<CategoryDto[]> {
  const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
  return rows.map(toCategoryDto);
}

/** แพ็กเกจทั้งหมดของบริการหลายตัว จัดกลุ่มตาม serviceId */
export async function plansByService(serviceIds: number[]): Promise<Map<number, Plan[]>> {
  const map = new Map<number, Plan[]>();
  if (serviceIds.length === 0) return map;
  const rows = await db.select().from(plans).where(inArray(plans.serviceId, serviceIds));
  for (const p of rows) map.set(p.serviceId, [...(map.get(p.serviceId) ?? []), p]);
  return map;
}

/**
 * ประวัติราคาของแพ็กเกจเป็นจุดเรียงเก่า → ใหม่ (สำหรับกราฟ)
 * จุดแรก = ราคาตอนสร้าง (old_price ของการแก้ครั้งแรก หรือราคาปัจจุบันถ้ายังไม่เคยแก้)
 */
export async function getPriceHistory(planId: number): Promise<PricePointDto[] | null> {
  const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
  if (!plan) return null;
  const changes = await db
    .select()
    .from(priceHistory)
    .where(eq(priceHistory.planId, planId))
    .orderBy(asc(priceHistory.changedAt), asc(priceHistory.id));
  if (changes.length === 0) {
    return [{ price: decimalToNumber(plan.price), from: plan.createdAt.toISOString() }];
  }
  return [
    { price: decimalToNumber(changes[0].oldPrice), from: plan.createdAt.toISOString() },
    ...changes.map((c) => ({ price: decimalToNumber(c.newPrice), from: c.changedAt.toISOString() })),
  ];
}

// ─── อ่านฝั่งผู้ใช้ (เฉพาะที่แสดงอยู่) ────────────────────────

/** บริการที่แสดงอยู่ ค้นตามชื่อและกรองตาม slug ของหมวด (US-B1) */
export async function listServicesPublic(filter: {
  q?: string;
  category?: string;
}): Promise<ServiceSummaryDto[]> {
  const q = filter.q?.trim();
  const rows = await db
    .select({ service: services, category: categories })
    .from(services)
    .innerJoin(categories, eq(services.categoryId, categories.id))
    .where(
      and(
        eq(services.isActive, true),
        q ? like(services.name, `%${q}%`) : undefined,
        filter.category ? eq(categories.slug, filter.category) : undefined,
      ),
    )
    .orderBy(asc(services.name));
  const planMap = await plansByService(rows.map((r) => r.service.id));
  return rows.map(({ service, category }) =>
    toServiceSummaryDto(service, category, planMap.get(service.id) ?? []),
  );
}

/** รายละเอียดบริการจาก slug (US-B2) — บริการที่ซ่อนถือว่าไม่พบ */
export async function getServiceBySlug(slug: string): Promise<ServiceDetailDto | null> {
  const [row] = await db
    .select({ service: services, category: categories })
    .from(services)
    .innerJoin(categories, eq(services.categoryId, categories.id))
    .where(and(eq(services.slug, slug), eq(services.isActive, true)))
    .limit(1);
  if (!row) return null;
  const planMap = await plansByService([row.service.id]);
  return toServiceDetailDto(row.service, row.category, planMap.get(row.service.id) ?? []);
}

/** บริการทุกตัวพร้อมแพ็กเกจที่เลือกได้ สำหรับขั้นเลือกบริการในฟอร์มเพิ่มรายการ */
export async function listSelectableServices(): Promise<ServiceDetailDto[]> {
  const rows = await db
    .select({ service: services, category: categories })
    .from(services)
    .innerJoin(categories, eq(services.categoryId, categories.id))
    .where(eq(services.isActive, true))
    .orderBy(asc(services.name));
  const planMap = await plansByService(rows.map((r) => r.service.id));
  return rows
    .map(({ service, category }) => toServiceDetailDto(service, category, planMap.get(service.id) ?? []))
    .filter((s) => s.plans.length > 0);
}
