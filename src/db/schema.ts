// Drizzle schema ของทุกตาราง — แหล่งความจริงเดียวของโครงสร้างฐานข้อมูล (docs/02-architecture.md ข้อ 3)
// ชื่อฟิลด์ใน TS เป็น camelCase และแปลงเป็น snake_case ใน DB อัตโนมัติ (casing: "snake_case")
// เงินเก็บเป็น DECIMAL(10,2) อ่านออกมาเป็น string แล้วคำนวณเป็นสตางค์ด้วย src/lib/money.ts เท่านั้น
import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  date,
  datetime,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  tinyint,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** id หลักของทุกตาราง */
const id = () => int({ unsigned: true }).autoincrement().primaryKey();
/** foreign key ชี้ไปที่ id ของตารางอื่น */
const fk = () => int({ unsigned: true });
const money = () => decimal({ precision: 10, scale: 2 });
const createdAt = () =>
  datetime({ mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`);
const updatedAt = () =>
  datetime({ mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => new Date());

export const billingCycles = ["monthly", "yearly"] as const;
export type BillingCycle = (typeof billingCycles)[number];

// ─── ผู้ใช้ ────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: id(),
  name: varchar({ length: 100 }).notNull(),
  email: varchar({ length: 191 }).notNull().unique(), // เก็บเป็นตัวพิมพ์เล็กเสมอ
  passwordHash: varchar({ length: 255 }).notNull(),
  role: mysqlEnum(["user", "admin"]).notNull().default("user"),
  status: mysqlEnum(["active", "suspended"]).notNull().default("active"),
  notifyEnabled: boolean().notNull().default(true),
  notifyDaysBefore: tinyint().notNull().default(3), // app รับแค่ 1 / 3 / 7
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ─── คลังข้อมูลที่ Admin ดูแล ──────────────────────────────

export const categories = mysqlTable("categories", {
  id: id(),
  name: varchar({ length: 50 }).notNull(),
  slug: varchar({ length: 50 }).notNull().unique(),
  icon: varchar({ length: 50 }),
  sortOrder: int().notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const services = mysqlTable(
  "services",
  {
    id: id(),
    categoryId: fk()
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    name: varchar({ length: 100 }).notNull(),
    slug: varchar({ length: 100 }).notNull().unique(),
    logoUrl: varchar({ length: 500 }),
    websiteUrl: varchar({ length: 500 }),
    cancelSteps: text().notNull(), // 1 บรรทัด = 1 ขั้นตอน เรนเดอร์เป็น <ol> (ไม่ใช่ markdown)
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(), // แสดงเป็น "อัปเดตข้อมูลล่าสุด"
  },
  (t) => [index("services_category_active_idx").on(t.categoryId, t.isActive)],
);

export const plans = mysqlTable("plans", {
  id: id(),
  serviceId: fk()
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  name: varchar({ length: 100 }).notNull(),
  price: money().notNull(),
  billingCycle: mysqlEnum(billingCycles).notNull(),
  maxMembers: tinyint().notNull().default(1), // > 1 = Family plan ที่หารกันได้
  isActive: boolean().notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** ทุกครั้งที่ Admin แก้ราคาแพ็กเกจ เขียนแถวนี้ในทรานแซกชันเดียวกัน */
export const priceHistory = mysqlTable(
  "price_history",
  {
    id: id(),
    planId: fk()
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    oldPrice: money().notNull(),
    newPrice: money().notNull(),
    changedBy: fk().references(() => users.id, { onDelete: "set null" }),
    changedAt: createdAt(),
  },
  (t) => [index("price_history_plan_changed_idx").on(t.planId, t.changedAt)],
);

// ─── รายการของผู้ใช้ ────────────────────────────────────────

/**
 * มี planId (เลือกจากคลัง) หรือ customName + customCategoryId (เพิ่มเอง) อย่างใดอย่างหนึ่ง — บังคับใน zod
 * price / billingCycle เป็น snapshot ของผู้ใช้ Admin แก้ราคาในคลังแล้วไม่เปลี่ยนตาม (ADR-005)
 */
export const userSubscriptions = mysqlTable(
  "user_subscriptions",
  {
    id: id(),
    userId: fk()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: fk().references(() => plans.id, { onDelete: "restrict" }),
    customName: varchar({ length: 100 }),
    customCategoryId: fk().references(() => categories.id, { onDelete: "restrict" }),
    price: money().notNull(),
    billingCycle: mysqlEnum(billingCycles).notNull(),
    nextBillingDate: date({ mode: "string" }).notNull(), // YYYY-MM-DD ตามเวลาไทย
    billingAnchorDay: tinyint().notNull(), // วันที่ 1–31 ที่ใช้เลื่อนรอบบิลไม่ให้ไหลหลังผ่านเดือนสั้น
    trialEndsAt: date({ mode: "string" }),
    paymentMethod: varchar({ length: 100 }),
    note: varchar({ length: 500 }),
    status: mysqlEnum(["active", "cancelled"]).notNull().default("active"),
    cancelledAt: datetime({ mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("user_subscriptions_user_status_idx").on(t.userId, t.status),
    index("user_subscriptions_status_next_idx").on(t.status, t.nextBillingDate),
  ],
);

/** ประวัติการแจ้งเตือน + ตัวกันส่งซ้ำ (unique ต่อรายการ ชนิด รอบบิล และช่องทาง) */
export const notifications = mysqlTable(
  "notifications",
  {
    id: id(),
    userId: fk()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userSubscriptionId: fk().references(() => userSubscriptions.id, { onDelete: "set null" }),
    type: mysqlEnum(["billing_reminder", "trial_ending", "member_reminder", "test"]).notNull(),
    channel: mysqlEnum(["email", "in_app"]).notNull(),
    title: varchar({ length: 200 }).notNull(),
    body: varchar({ length: 1000 }).notNull(),
    link: varchar({ length: 300 }),
    dueDate: date({ mode: "string" }), // รอบบิล/วันหมดทดลองที่แจ้ง — null สำหรับอีเมลทดสอบ
    status: mysqlEnum(["pending", "sent", "failed"]).notNull().default("pending"),
    attempts: tinyint().notNull().default(0),
    readAt: datetime({ mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("notifications_dedupe_uq").on(t.userSubscriptionId, t.type, t.dueDate, t.channel),
    index("notifications_user_channel_read_idx").on(t.userId, t.channel, t.readAt),
  ],
);

// ─── หารค่าบริการ (P1) ──────────────────────────────────────

export const shareGroups = mysqlTable("share_groups", {
  id: id(),
  ownerId: fk()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  userSubscriptionId: fk()
    .notNull()
    .unique()
    .references(() => userSubscriptions.id, { onDelete: "cascade" }),
  name: varchar({ length: 100 }).notNull(),
  promptpayId: varchar({ length: 20 }).notNull(), // เบอร์ 10 หลัก หรือเลขบัตรประชาชน 13 หลัก
  splitMode: mysqlEnum(["equal", "custom"]).notNull().default("equal"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const groupMembers = mysqlTable("group_members", {
  id: id(),
  groupId: fk()
    .notNull()
    .references(() => shareGroups.id, { onDelete: "cascade" }),
  name: varchar({ length: 100 }).notNull(),
  email: varchar({ length: 191 }),
  amount: money().notNull(),
  payToken: char({ length: 43 }).notNull().unique(), // 32 byte สุ่ม base64url ใช้เปิดหน้าจ่ายโดยไม่ล็อกอิน
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** ไม่มีแถว = ยังไม่จ่าย สร้างแถวตอนเจ้าของกดเปลี่ยนสถานะ */
export const memberPayments = mysqlTable(
  "member_payments",
  {
    id: id(),
    memberId: fk()
      .notNull()
      .references(() => groupMembers.id, { onDelete: "cascade" }),
    period: char({ length: 7 }).notNull(), // YYYY-MM
    status: mysqlEnum(["unpaid", "paid"]).notNull().default("unpaid"),
    paidAt: datetime({ mode: "date" }),
    remindedAt: datetime({ mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("member_payments_member_period_uq").on(t.memberId, t.period)],
);

export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
