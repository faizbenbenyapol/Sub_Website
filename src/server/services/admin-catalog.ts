import "server-only";
import { and, asc, count, eq, inArray, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { isDuplicateKey, isMissingReference, isRowReferenced } from "@/db/errors";
import { categories, plans, priceHistory, services, userSubscriptions } from "@/db/schema";
import { decimalToNumber, satangToDecimal, toSatang } from "@/lib/money";
import type { CategoryCreate, PlanCreate, ServiceCreate } from "@/lib/validation/catalog";
import { ApiError } from "../http";
import {
  plansByService,
  toCategoryDto,
  toPlanDto,
  toServiceDetailDto,
  toServiceSummaryDto,
  type CategoryDto,
  type ServiceSummaryDto,
} from "./catalog";

// CRUD คลังข้อมูลสำหรับหลังบ้าน (US-H1–H3) — เรียกจาก route ที่ผ่าน requireAdmin() แล้วเท่านั้น

const notFound = (what: string) => new ApiError(404, "NOT_FOUND", `ไม่พบ${what}`);
const slugTaken = () =>
  new ApiError(400, "VALIDATION_ERROR", "slug นี้ถูกใช้แล้ว", { slug: "slug นี้ถูกใช้แล้ว เลือกชื่ออื่น" });

/** แปลง error จาก DB ที่คาดไว้ (slug ซ้ำ, หมวดไม่มีอยู่) เป็น ApiError */
function mapWriteError(err: unknown): never {
  if (isDuplicateKey(err)) throw slugTaken();
  if (isMissingReference(err)) {
    throw new ApiError(400, "VALIDATION_ERROR", "ไม่พบหมวดที่เลือก", { categoryId: "ไม่พบหมวดที่เลือก" });
  }
  throw err;
}

// ─── หมวด ───────────────────────────────────────────────────

export type AdminCategoryDto = CategoryDto & { serviceCount: number };

/** หมวดทั้งหมดพร้อมจำนวนบริการ */
export async function listCategoriesAdmin(): Promise<AdminCategoryDto[]> {
  const rows = await db
    .select({ category: categories, serviceCount: count(services.id) })
    .from(categories)
    .leftJoin(services, eq(services.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  return rows.map((r) => ({ ...toCategoryDto(r.category), serviceCount: r.serviceCount }));
}

/** อ่านหมวดเดียว — ไม่พบโยน 404 */
async function getCategoryRow(id: number) {
  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  if (!row) throw notFound("หมวดนี้");
  return row;
}

/** สร้างหมวด */
export async function createCategory(input: CategoryCreate): Promise<CategoryDto> {
  try {
    const [{ id }] = await db.insert(categories).values(input).$returningId();
    return toCategoryDto(await getCategoryRow(id));
  } catch (err) {
    mapWriteError(err);
  }
}

/** แก้หมวด */
export async function updateCategory(id: number, input: Partial<CategoryCreate>): Promise<CategoryDto> {
  await getCategoryRow(id);
  if (Object.keys(input).length > 0) {
    try {
      await db.update(categories).set(input).where(eq(categories.id, id));
    } catch (err) {
      mapWriteError(err);
    }
  }
  return toCategoryDto(await getCategoryRow(id));
}

/** ลบหมวด — ไม่ยอมถ้ามีบริการหรือรายการ custom ของผู้ใช้อยู่ในหมวดนี้ */
export async function deleteCategory(id: number): Promise<void> {
  await getCategoryRow(id);
  const [[svc], [subs]] = await Promise.all([
    db.select({ n: count() }).from(services).where(eq(services.categoryId, id)),
    db.select({ n: count() }).from(userSubscriptions).where(eq(userSubscriptions.customCategoryId, id)),
  ]);
  if (svc.n > 0 || subs.n > 0) {
    const parts = [svc.n > 0 && `บริการ ${svc.n} รายการ`, subs.n > 0 && `รายการของผู้ใช้ ${subs.n} รายการ`];
    throw new ApiError(
      409,
      "IN_USE",
      `ลบไม่ได้ เพราะยังมี${parts.filter(Boolean).join(" และ ")}อยู่ในหมวดนี้`,
    );
  }
  try {
    await db.delete(categories).where(eq(categories.id, id));
  } catch (err) {
    if (isRowReferenced(err)) throw new ApiError(409, "IN_USE", "ลบไม่ได้ เพราะหมวดนี้ยังถูกใช้งานอยู่");
    throw err;
  }
}

// ─── บริการ ─────────────────────────────────────────────────

export type AdminServiceSummaryDto = ServiceSummaryDto & {
  isActive: boolean;
  planCount: number;
  subscriberCount: number; // รายการ active ของผู้ใช้ที่ผูกกับแพ็กเกจของบริการนี้
};

/** นับรายการของผู้ใช้ที่ผูกกับแต่ละบริการ (activeOnly = เฉพาะที่ยังใช้งาน) */
async function subscriberCounts(serviceIds: number[], activeOnly: boolean) {
  if (serviceIds.length === 0) return new Map<number, number>();
  const rows = await db
    .select({ serviceId: plans.serviceId, n: count() })
    .from(userSubscriptions)
    .innerJoin(plans, eq(userSubscriptions.planId, plans.id))
    .where(
      and(
        inArray(plans.serviceId, serviceIds),
        activeOnly ? eq(userSubscriptions.status, "active") : undefined,
      ),
    )
    .groupBy(plans.serviceId);
  return new Map(rows.map((r) => [r.serviceId, r.n]));
}

/** บริการทั้งหมด (รวมที่ซ่อน) ค้นตามชื่อ/slug และกรองตาม slug ของหมวดได้ */
export async function listServicesAdmin(filter: {
  q?: string;
  category?: string;
}): Promise<AdminServiceSummaryDto[]> {
  const q = filter.q?.trim();
  const rows = await db
    .select({ service: services, category: categories })
    .from(services)
    .innerJoin(categories, eq(services.categoryId, categories.id))
    .where(
      and(
        q ? or(like(services.name, `%${q}%`), like(services.slug, `%${q}%`)) : undefined,
        filter.category ? eq(categories.slug, filter.category) : undefined,
      ),
    )
    .orderBy(asc(services.name));
  const ids = rows.map((r) => r.service.id);
  const [planMap, subs] = await Promise.all([plansByService(ids), subscriberCounts(ids, true)]);
  return rows.map(({ service, category }) => {
    const servicePlans = planMap.get(service.id) ?? [];
    return {
      ...toServiceSummaryDto(service, category, servicePlans),
      isActive: service.isActive,
      planCount: servicePlans.length,
      subscriberCount: subs.get(service.id) ?? 0,
    };
  });
}

/** รายละเอียดบริการสำหรับหน้าแก้ไข (แพ็กเกจรวมที่ซ่อน) */
export async function getServiceAdmin(id: number) {
  const [row] = await db
    .select({ service: services, category: categories })
    .from(services)
    .innerJoin(categories, eq(services.categoryId, categories.id))
    .where(eq(services.id, id))
    .limit(1);
  if (!row) throw notFound("บริการนี้");
  const planMap = await plansByService([id]);
  return {
    ...toServiceDetailDto(row.service, row.category, planMap.get(id) ?? [], true),
    isActive: row.service.isActive,
    cancelStepsText: row.service.cancelSteps,
  };
}

/** สร้างบริการ (ยังไม่มีแพ็กเกจ) */
export async function createService(input: ServiceCreate) {
  try {
    const [{ id }] = await db.insert(services).values(input).$returningId();
    return getServiceAdmin(id);
  } catch (err) {
    mapWriteError(err);
  }
}

/** แก้บริการ — updated_at เปลี่ยนเอง = "อัปเดตข้อมูลล่าสุด" ที่ผู้ใช้เห็น */
export async function updateService(id: number, input: Partial<ServiceCreate>) {
  await getServiceAdmin(id);
  try {
    await db
      .update(services)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(services.id, id));
  } catch (err) {
    mapWriteError(err);
  }
  return getServiceAdmin(id);
}

/** ลบบริการ — ถ้ามีผู้ใช้ผูกอยู่ (แม้ยกเลิกแล้ว) ให้ซ่อนแทน เพื่อไม่ให้ประวัติของผู้ใช้หาย (US-H2) */
export async function deleteService(id: number): Promise<void> {
  await getServiceAdmin(id);
  const total = (await subscriberCounts([id], false)).get(id) ?? 0;
  if (total > 0) {
    throw new ApiError(
      409,
      "IN_USE",
      `มีผู้ใช้ผูกบริการนี้อยู่ ${total} รายการ ลบไม่ได้ — ซ่อนบริการแทนการลบ`,
    );
  }
  await db.delete(services).where(eq(services.id, id)); // แพ็กเกจและประวัติราคาถูกลบตาม (cascade)
}

// ─── แพ็กเกจ ────────────────────────────────────────────────

/** อ่านแพ็กเกจเดียว — ไม่พบโยน 404 */
async function getPlanRow(id: number) {
  const [row] = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
  if (!row) throw notFound("แพ็กเกจนี้");
  return row;
}

/** แตะ updated_at ของบริการ เพื่อให้ "อัปเดตข้อมูลล่าสุด" ขยับเมื่อแพ็กเกจเปลี่ยน */
function touchService(tx: Pick<typeof db, "update">, serviceId: number) {
  return tx.update(services).set({ updatedAt: new Date() }).where(eq(services.id, serviceId));
}

/** เพิ่มแพ็กเกจให้บริการ */
export async function createPlan(serviceId: number, input: PlanCreate) {
  await getServiceAdmin(serviceId);
  const id = await db.transaction(async (tx) => {
    const [{ id }] = await tx
      .insert(plans)
      .values({ ...input, serviceId, price: satangToDecimal(toSatang(input.price)) })
      .$returningId();
    await touchService(tx, serviceId);
    return id;
  });
  return toPlanDto(await getPlanRow(id));
}

/**
 * แก้แพ็กเกจ — ถ้าราคาเปลี่ยนจริง เขียน price_history ในทรานแซกชันเดียวกัน (US-H3)
 * เขียนประวัติพลาด = ราคาไม่เปลี่ยน
 */
export async function updatePlan(id: number, input: Partial<PlanCreate>, adminId: number) {
  const current = await getPlanRow(id);
  const { price, ...rest } = input;
  const newSatang = price === undefined ? undefined : toSatang(price);
  const priceChanged = newSatang !== undefined && newSatang !== toSatang(current.price);

  await db.transaction(async (tx) => {
    await tx
      .update(plans)
      .set({ ...rest, ...(newSatang !== undefined && { price: satangToDecimal(newSatang) }) })
      .where(eq(plans.id, id));
    if (priceChanged) {
      await tx.insert(priceHistory).values({
        planId: id,
        oldPrice: current.price,
        newPrice: satangToDecimal(newSatang),
        changedBy: adminId,
      });
    }
    await touchService(tx, current.serviceId);
  });
  return toPlanDto(await getPlanRow(id));
}

/** ลบแพ็กเกจ — ไม่ยอมถ้ามีผู้ใช้ผูกอยู่ (ซ่อนแทน) */
export async function deletePlan(id: number): Promise<void> {
  const plan = await getPlanRow(id);
  const [{ n }] = await db
    .select({ n: count() })
    .from(userSubscriptions)
    .where(eq(userSubscriptions.planId, id));
  if (n > 0) {
    throw new ApiError(409, "IN_USE", `มีผู้ใช้ผูกแพ็กเกจนี้อยู่ ${n} รายการ ลบไม่ได้ — ซ่อนแพ็กเกจแทน`);
  }
  try {
    await db.transaction(async (tx) => {
      await tx.delete(plans).where(eq(plans.id, id));
      await touchService(tx, plan.serviceId);
    });
  } catch (err) {
    // ผู้ใช้เพิ่มรายการเข้ามาระหว่างนับกับลบ → FK RESTRICT
    if (isRowReferenced(err))
      throw new ApiError(409, "IN_USE", "มีผู้ใช้ผูกแพ็กเกจนี้อยู่ ลบไม่ได้ — ซ่อนแพ็กเกจแทน");
    throw err;
  }
}

/** ประวัติการแก้ราคาทุกแพ็กเกจของบริการ (ใหม่ → เก่า) สำหรับหน้าแก้ไขของ admin */
export async function priceChangesOfService(serviceId: number) {
  const rows = await db
    .select({
      id: priceHistory.id,
      planName: plans.name,
      oldPrice: priceHistory.oldPrice,
      newPrice: priceHistory.newPrice,
      changedAt: priceHistory.changedAt,
    })
    .from(priceHistory)
    .innerJoin(plans, eq(priceHistory.planId, plans.id))
    .where(eq(plans.serviceId, serviceId))
    .orderBy(sql`${priceHistory.changedAt} desc`, sql`${priceHistory.id} desc`);
  return rows.map((r) => ({
    id: r.id,
    planName: r.planName,
    oldPrice: decimalToNumber(r.oldPrice),
    newPrice: decimalToNumber(r.newPrice),
    changedAt: r.changedAt.toISOString(),
  }));
}
