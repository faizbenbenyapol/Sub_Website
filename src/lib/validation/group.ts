import { normalizePromptpayId, promptpayKind } from "../promptpay";
import { priceSchema } from "./catalog";
import { z } from "./index";

// schema กลุ่มหารค่าบริการ (US-F1–F3, docs/02 ข้อ 5.9)

export const MAX_MEMBERS = 10;

export const promptpayIdSchema = z
  .string({ error: "กรุณากรอก PromptPay ID" })
  .transform(normalizePromptpayId)
  .refine((id) => promptpayKind(id) !== null, "ใช้เบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน 13 หลักที่ถูกต้อง");

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.email("รูปแบบอีเมลไม่ถูกต้อง").max(191).nullable())
  .nullable()
  .optional();

export const memberSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(100, "ชื่อยาวได้ไม่เกิน 100 ตัวอักษร"),
  email: optionalEmail,
  amount: priceSchema.optional(), // บังคับเฉพาะโหมดกำหนดเอง (ตรวจใน service)
});

export const groupCreateSchema = z.object({
  subscriptionId: z.coerce.number({ error: "กรุณาเลือกรายการ" }).int().positive("กรุณาเลือกรายการ"),
  name: z.string().trim().max(100).optional(),
  promptpayId: promptpayIdSchema,
  splitMode: z.enum(["equal", "custom"]),
  members: z
    .array(memberSchema)
    .min(1, "เพิ่มสมาชิกอย่างน้อย 1 คน")
    .max(MAX_MEMBERS, `สมาชิกได้ไม่เกิน ${MAX_MEMBERS} คน`),
});

export const groupUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "กรุณากรอกชื่อกลุ่ม").max(100),
    promptpayId: promptpayIdSchema,
    splitMode: z.enum(["equal", "custom"]),
  })
  .partial();

export const memberUpdateSchema = memberSchema.partial();

export const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "period ต้องอยู่ในรูปแบบ YYYY-MM");

export const paymentSchema = z.object({
  memberId: z.coerce.number().int().positive(),
  period: periodSchema,
  status: z.enum(["paid", "unpaid"]),
});

export type GroupCreate = z.infer<typeof groupCreateSchema>;
export type MemberInput = z.infer<typeof memberSchema>;
