import { todayInBangkok } from "../dates";
import { priceSchema } from "./catalog";
import { z } from "./index";

// schema รายการของผู้ใช้ (US-C1, C2) — ใช้ทั้งฟอร์มและ API (docs/02 ข้อ 5.5)

const isoDate = z.iso.date({ error: "รูปแบบวันที่ไม่ถูกต้อง" });

/** วันตัดเงินต้องไม่อยู่ในอดีต (ตามเวลาไทย) — ตรวจตอน parse จึงได้ "วันนี้" ล่าสุดเสมอ */
const billingDate = z
  .string({ error: "กรุณาเลือกวันตัดเงินถัดไป" })
  .min(1, "กรุณาเลือกวันตัดเงินถัดไป")
  .pipe(isoDate)
  .refine((d) => d >= todayInBangkok(), "วันตัดเงินถัดไปต้องเป็นวันนี้หรือหลังจากนี้");

/** ข้อความไม่บังคับ: ช่องว่าง → null */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}ยาวได้ไม่เกิน ${max} ตัวอักษร`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const optionalDate = z
  .union([z.literal(""), isoDate, z.null()])
  .transform((v) => (v === "" ? null : v))
  .optional();

const id = (message: string) => z.coerce.number({ error: message }).int().positive(message);

const common = {
  price: priceSchema,
  billingCycle: z.enum(["monthly", "yearly"], { error: "เลือกรอบบิลรายเดือนหรือรายปี" }),
  nextBillingDate: billingDate,
  trialEndsAt: optionalDate,
  paymentMethod: optionalText(100, "ช่องทางจ่าย"),
  note: optionalText(500, "หมายเหตุ"),
};

/** เพิ่มรายการ: เลือกจากคลัง (planId) หรือเพิ่มเอง (customName + customCategoryId) อย่างใดอย่างหนึ่ง */
export const subscriptionCreateSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("catalog"), planId: id("กรุณาเลือกแพ็กเกจ"), ...common }),
  z.object({
    source: z.literal("custom"),
    customName: z.string().trim().min(1, "กรุณากรอกชื่อบริการ").max(100, "ชื่อยาวได้ไม่เกิน 100 ตัวอักษร"),
    customCategoryId: id("กรุณาเลือกหมวด"),
    ...common,
  }),
]);

/** แก้รายการ: ส่งเฉพาะช่องที่เปลี่ยน + เปลี่ยนสถานะ (ยกเลิก/กลับมาใช้) — ย้ายจาก custom เป็นคลังไม่ได้ */
export const subscriptionUpdateSchema = z
  .object({
    planId: id("กรุณาเลือกแพ็กเกจ"),
    customName: z.string().trim().min(1, "กรุณากรอกชื่อบริการ").max(100, "ชื่อยาวได้ไม่เกิน 100 ตัวอักษร"),
    customCategoryId: id("กรุณาเลือกหมวด"),
    ...common,
    status: z.enum(["active", "cancelled"]),
  })
  .partial();

export type SubscriptionCreate = z.infer<typeof subscriptionCreateSchema>;
export type SubscriptionUpdate = z.infer<typeof subscriptionUpdateSchema>;
