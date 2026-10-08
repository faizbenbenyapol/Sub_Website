import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { db } from "@/db";
import { isMissingReference } from "@/db/errors";
import { categories, plans, services, shareGroups, userSubscriptions } from "@/db/schema";
import { anchorDayOf, monthlySatang, rollForward } from "@/lib/billing";
import { todayInBangkok } from "@/lib/dates";
import { decimalToNumber, fromSatang, satangToDecimal, toSatang } from "@/lib/money";
import type { SubscriptionCreate, SubscriptionUpdate } from "@/lib/validation/subscription";
import { ApiError } from "../http";
import { toCategoryDto, type CategoryDto } from "./catalog";
import { prepareGroupForSubscriptionChange } from "./groups";

// รายการ subscription ของผู้ใช้ (US-C1, C2) — ทุกฟังก์ชันรับ userId และกรองด้วย user_id ใน SQL เสมอ (US-A3)

export type SubscriptionDto = {
  id: number;
  name: string;
  logoUrl: string | null;
  category: CategoryDto;
  isCustom: boolean;
  service: { id: number; slug: string } | null;
  plan: { id: number; name: string } | null;
  price: number;
  billingCycle: "monthly" | "yearly";
  monthlyCost: number;
  catalogPrice: number | null; // ราคาปัจจุบันในคลัง — ต่างจาก price = แสดงป้าย "ราคาในคลังเปลี่ยน"
  billingAnchorDay: number;
  nextBillingDate: string; // รายการ active ที่เลยวันมาแล้วจะถูกเลื่อนให้ตอนอ่าน (กันกรณีงานรายวันยังไม่ได้รัน)
  trialEndsAt: string | null;
  paymentMethod: string | null;
  note: string | null;
  status: "active" | "cancelled";
  cancelledAt: string | null;
  createdAt: string;
  groupId: number | null;
};

const serviceCategory = alias(categories, "service_category");
const customCategory = alias(categories, "custom_category");
const notFound = () => new ApiError(404, "NOT_FOUND", "ไม่พบรายการนี้");

/** query พื้นฐาน: รายการ + แพ็กเกจ + บริการ + หมวด (ของบริการหรือของ custom) + กลุ่มหาร */
function baseQuery() {
  return db
    .select({
      sub: userSubscriptions,
      plan: plans,
      service: services,
      serviceCategory,
      customCategory,
      groupId: shareGroups.id,
    })
    .from(userSubscriptions)
    .leftJoin(plans, eq(userSubscriptions.planId, plans.id))
    .leftJoin(services, eq(plans.serviceId, services.id))
    .leftJoin(serviceCategory, eq(services.categoryId, serviceCategory.id))
    .leftJoin(customCategory, eq(userSubscriptions.customCategoryId, customCategory.id))
    .leftJoin(shareGroups, eq(shareGroups.userSubscriptionId, userSubscriptions.id));
}

type Row = Awaited<ReturnType<typeof baseQuery>>[number];

/** แถวจาก baseQuery → DTO ตาม docs/02 ข้อ 5.2 */
function toDto(row: Row, today: string): SubscriptionDto {
  const { sub, plan, service } = row;
  const category = row.serviceCategory ?? row.customCategory;
  if (!category) throw new Error(`รายการ ${sub.id} ไม่มีหมวด`);
  const priceSatang = toSatang(sub.price);
  return {
    id: sub.id,
    name: service?.name ?? sub.customName ?? "",
    logoUrl: service?.logoUrl ?? null,
    category: toCategoryDto(category),
    isCustom: sub.planId === null,
    service: service ? { id: service.id, slug: service.slug } : null,
    plan: plan ? { id: plan.id, name: plan.name } : null,
    price: fromSatang(priceSatang),
    billingCycle: sub.billingCycle,
    monthlyCost: fromSatang(monthlySatang(priceSatang, sub.billingCycle)),
    catalogPrice: plan ? decimalToNumber(plan.price) : null,
    billingAnchorDay: sub.billingAnchorDay,
    nextBillingDate:
      sub.status === "active"
        ? rollForward(sub.nextBillingDate, sub.billingCycle, sub.billingAnchorDay, today)
        : sub.nextBillingDate,
    trialEndsAt: sub.trialEndsAt,
    paymentMethod: sub.paymentMethod,
    note: sub.note,
    status: sub.status,
    cancelledAt: sub.cancelledAt?.toISOString() ?? null,
    createdAt: sub.createdAt.toISOString(),
    groupId: row.groupId ?? null,
  };
}

/** รายการของผู้ใช้ เรียงตามวันตัดเงินถัดไป */
export async function listSubscriptions(
  userId: number,
  status: "active" | "cancelled" | "all" = "active",
): Promise<SubscriptionDto[]> {
  const today = todayInBangkok();
  const rows = await baseQuery()
    .where(
      and(
        eq(userSubscriptions.userId, userId),
        status === "all" ? undefined : eq(userSubscriptions.status, status),
      ),
    )
    .orderBy(asc(userSubscriptions.nextBillingDate), asc(userSubscriptions.id));
  return rows
    .map((r) => toDto(r, today))
    .sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate) || a.id - b.id);
}

/** รายการเดียวของผู้ใช้ — ไม่ใช่ของตัวเองได้ 404 เหมือนไม่มีอยู่ */
export async function getSubscription(userId: number, id: number): Promise<SubscriptionDto> {
  const [row] = await baseQuery()
    .where(and(eq(userSubscriptions.id, id), eq(userSubscriptions.userId, userId)))
    .limit(1);
  if (!row) throw notFound();
  return toDto(row, todayInBangkok());
}

/** แพ็กเกจที่ผู้ใช้เลือกได้: ต้องมีอยู่ แสดงอยู่ และบริการไม่ถูกซ่อน */
async function selectablePlan(planId: number) {
  const [row] = await db
    .select({ plan: plans })
    .from(plans)
    .innerJoin(services, eq(plans.serviceId, services.id))
    .where(and(eq(plans.id, planId), eq(plans.isActive, true), eq(services.isActive, true)))
    .limit(1);
  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "ไม่พบแพ็กเกจนี้ หรือแพ็กเกจถูกซ่อนแล้ว", {
      planId: "ไม่พบแพ็กเกจนี้ เลือกแพ็กเกจอื่น",
    });
  }
  return row.plan;
}

const missingCategory = () =>
  new ApiError(400, "VALIDATION_ERROR", "ไม่พบหมวดที่เลือก", { customCategoryId: "ไม่พบหมวดที่เลือก" });

/** เพิ่มรายการ — anchor day มาจากวันตัดเงินที่ผู้ใช้กรอก */
export async function createSubscription(
  userId: number,
  input: SubscriptionCreate,
): Promise<SubscriptionDto> {
  const base = {
    userId,
    price: satangToDecimal(toSatang(input.price)),
    billingCycle: input.billingCycle,
    nextBillingDate: input.nextBillingDate,
    billingAnchorDay: anchorDayOf(input.nextBillingDate),
    trialEndsAt: input.trialEndsAt ?? null,
    paymentMethod: input.paymentMethod ?? null,
    note: input.note ?? null,
  };
  let id: number;
  if (input.source === "catalog") {
    await selectablePlan(input.planId);
    [{ id }] = await db
      .insert(userSubscriptions)
      .values({ ...base, planId: input.planId })
      .$returningId();
  } else {
    try {
      [{ id }] = await db
        .insert(userSubscriptions)
        .values({ ...base, customName: input.customName, customCategoryId: input.customCategoryId })
        .$returningId();
    } catch (err) {
      if (isMissingReference(err)) throw missingCategory();
      throw err;
    }
  }
  return getSubscription(userId, id);
}

/** แก้รายการ รวมการยกเลิก / กลับมาใช้ (US-C2) */
export async function updateSubscription(
  userId: number,
  id: number,
  input: SubscriptionUpdate,
): Promise<SubscriptionDto> {
  const [current] = await db
    .select()
    .from(userSubscriptions)
    .where(and(eq(userSubscriptions.id, id), eq(userSubscriptions.userId, userId)))
    .limit(1);
  if (!current) throw notFound();

  const isCustom = current.planId === null;
  if (isCustom && input.planId !== undefined) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "รายการที่เพิ่มเองเปลี่ยนเป็นแพ็กเกจในคลังไม่ได้ ลบแล้วเพิ่มใหม่แทน",
    );
  }
  if (!isCustom && (input.customName !== undefined || input.customCategoryId !== undefined)) {
    throw new ApiError(400, "VALIDATION_ERROR", "รายการจากคลังแก้ชื่อหรือหมวดไม่ได้");
  }
  if (input.planId !== undefined && input.planId !== current.planId) {
    const [currentPlan] = await db.select().from(plans).where(eq(plans.id, current.planId!)).limit(1);
    const next = await selectablePlan(input.planId);
    if (next.serviceId !== currentPlan?.serviceId) {
      throw new ApiError(400, "VALIDATION_ERROR", "เลือกได้เฉพาะแพ็กเกจของบริการเดิม", {
        planId: "เลือกได้เฉพาะแพ็กเกจของบริการเดิม",
      });
    }
  }

  const reactivating = input.status === "active" && current.status === "cancelled";
  if (reactivating && !input.nextBillingDate && current.nextBillingDate < todayInBangkok()) {
    throw new ApiError(400, "VALIDATION_ERROR", "กลับมาใช้ต้องระบุวันตัดเงินถัดไป", {
      nextBillingDate: "กรุณาเลือกวันตัดเงินถัดไป",
    });
  }

  const { status, price, nextBillingDate, ...rest } = input;
  const syncGroup = await prepareGroupForSubscriptionChange(id, {
    priceSatang: price === undefined ? undefined : toSatang(price),
    billingCycle: input.billingCycle,
  });
  try {
    await db
      .update(userSubscriptions)
      .set({
        ...rest,
        ...(price !== undefined && { price: satangToDecimal(toSatang(price)) }),
        ...(nextBillingDate && { nextBillingDate, billingAnchorDay: anchorDayOf(nextBillingDate) }),
        ...(status === "cancelled" && current.status !== "cancelled" && { status, cancelledAt: new Date() }),
        ...(reactivating && { status, cancelledAt: null }),
      })
      .where(and(eq(userSubscriptions.id, id), eq(userSubscriptions.userId, userId)));
  } catch (err) {
    if (isMissingReference(err)) throw missingCategory();
    throw err;
  }
  await syncGroup?.();
  return getSubscription(userId, id);
}

/** ลบรายการ (กลุ่มหารที่ผูกไว้ถูกลบตามด้วย cascade) */
export async function deleteSubscription(userId: number, id: number): Promise<void> {
  const [result] = await db
    .delete(userSubscriptions)
    .where(and(eq(userSubscriptions.id, id), eq(userSubscriptions.userId, userId)));
  if (result.affectedRows === 0) throw notFound();
}
