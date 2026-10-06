// ใส่ข้อมูลเริ่มต้น: หมวด + บริการ + แพ็กเกจ, บัญชี admin และบัญชีตัวอย่าง (รันซ้ำได้ ไม่สร้างของซ้ำ)
// ใช้: npm run db:seed
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { anchorDayOf } from "../src/lib/billing";
import { addDays, todayInBangkok } from "../src/lib/dates";
import { categories, plans, services, userSubscriptions, users } from "../src/db/schema";
import { connect } from "./db";
import { seedCategories, seedServices } from "./seed-data";

const { pool, db } = connect();

/** ใส่หมวดที่ยังไม่มี แล้วคืน map slug → id */
async function seedCategoryRows() {
  for (const [i, c] of seedCategories.entries()) {
    await db
      .insert(categories)
      .values({ ...c, sortOrder: i })
      .onDuplicateKeyUpdate({ set: { slug: c.slug } });
  }
  const rows = await db.select().from(categories);
  return new Map(rows.map((r) => [r.slug, r.id]));
}

/** ใส่บริการที่ยังไม่มีพร้อมแพ็กเกจ — บริการที่มีอยู่แล้วไม่แตะ (Admin อาจแก้ไปแล้ว) */
async function seedServiceRows(categoryIds: Map<string, number>) {
  let created = 0;
  for (const s of seedServices) {
    const [existing] = await db.select({ id: services.id }).from(services).where(eq(services.slug, s.slug));
    if (existing) continue;
    const categoryId = categoryIds.get(s.category);
    if (!categoryId) throw new Error(`ไม่พบหมวด ${s.category} ของ ${s.slug}`);
    const [{ id }] = await db
      .insert(services)
      .values({
        slug: s.slug,
        name: s.name,
        categoryId,
        websiteUrl: s.websiteUrl,
        cancelSteps: s.cancelSteps.join("\n"),
      })
      .$returningId();
    await db.insert(plans).values(
      s.plans.map((p) => ({
        serviceId: id,
        name: p.name,
        price: p.price.toFixed(2),
        billingCycle: p.cycle,
        maxMembers: p.maxMembers ?? 1,
      })),
    );
    created++;
  }
  return created;
}

/** สร้างผู้ใช้ถ้ายังไม่มีอีเมลนี้ — คืน id และบอกว่าสร้างใหม่หรือไม่ */
async function ensureUser(name: string, email: string, password: string, role: "user" | "admin") {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) return { id: existing.id, created: false };
  const passwordHash = await bcrypt.hash(password, 10);
  const [{ id }] = await db.insert(users).values({ name, email, passwordHash, role }).$returningId();
  return { id, created: true };
}

/** หาแพ็กเกจจาก slug บริการ + ชื่อแพ็กเกจ */
async function planOf(slug: string, planName: string) {
  const [row] = await db
    .select({ id: plans.id, price: plans.price, cycle: plans.billingCycle })
    .from(plans)
    .innerJoin(services, eq(plans.serviceId, services.id))
    .where(and(eq(services.slug, slug), eq(plans.name, planName)));
  if (!row) throw new Error(`ไม่พบแพ็กเกจ ${slug} / ${planName}`);
  return row;
}

/** รายการตัวอย่างของบัญชี demo — วันที่คิดจากวันนี้ ให้ dashboard มีของในช่วง 7 วันเสมอ */
async function seedDemoSubscriptions(userId: number, otherCategoryId: number) {
  const today = todayInBangkok();
  const fromPlan = async (
    slug: string,
    planName: string,
    inDays: number,
    extra: Partial<typeof userSubscriptions.$inferInsert> = {},
  ) => {
    const p = await planOf(slug, planName);
    const date = addDays(today, inDays);
    return {
      userId,
      planId: p.id,
      price: p.price,
      billingCycle: p.cycle,
      nextBillingDate: date,
      billingAnchorDay: anchorDayOf(date),
      ...extra,
    };
  };
  const gymDate = addDays(today, 12);
  await db.insert(userSubscriptions).values([
    await fromPlan("netflix", "Premium", 3, { paymentMethod: "บัตร KBank" }),
    await fromPlan("spotify", "Premium Family", 0, { paymentMethod: "บัตร KBank" }),
    await fromPlan("icloud-plus", "200 GB", 9, { paymentMethod: "App Store" }),
    await fromPlan("microsoft-365", "Personal รายปี", 40),
    await fromPlan("youtube-premium", "รายบุคคล", 5, {
      trialEndsAt: addDays(today, 5),
      note: "ทดลองใช้ฟรีเดือนแรก",
    }),
    await fromPlan("hbo-max", "Standard", 20, { status: "cancelled", cancelledAt: new Date() }),
    {
      userId,
      customName: "ฟิตเนสใกล้หอ",
      customCategoryId: otherCategoryId,
      price: "1200.00",
      billingCycle: "monthly" as const,
      nextBillingDate: gymDate,
      billingAnchorDay: anchorDayOf(gymDate),
      paymentMethod: "โอนเงิน",
    },
  ]);
}

async function main() {
  const categoryIds = await seedCategoryRows();
  const createdServices = await seedServiceRows(categoryIds);
  console.log(
    `หมวด ${categoryIds.size} หมวด · เพิ่มบริการใหม่ ${createdServices} จาก ${seedServices.length} รายการ`,
  );

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword && adminPassword.length >= 8) {
    const admin = await ensureUser("แอดมินตัดยัง", adminEmail, adminPassword, "admin");
    console.log(`admin ${adminEmail}: ${admin.created ? "สร้างใหม่" : "มีอยู่แล้ว"}`);
  } else {
    console.warn("ข้ามการสร้าง admin — ตั้ง ADMIN_EMAIL และ ADMIN_PASSWORD (≥ 8 ตัว) ใน .env");
  }

  const demoEmail = process.env.DEMO_EMAIL?.toLowerCase();
  const demoPassword = process.env.DEMO_PASSWORD;
  if (demoEmail && demoPassword && demoPassword.length >= 8) {
    const demo = await ensureUser("มายด์", demoEmail, demoPassword, "user");
    if (demo.created) await seedDemoSubscriptions(demo.id, categoryIds.get("other")!);
    console.log(`บัญชีตัวอย่าง ${demoEmail}: ${demo.created ? "สร้างใหม่พร้อม 7 รายการ" : "มีอยู่แล้ว"}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
