import { z } from "./index";

// schema ของคลังข้อมูลที่ Admin แก้ได้ — ใช้ทั้งฟอร์มหลังบ้านและ API (docs/02 ข้อ 5.10)

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "กรุณากรอก slug")
  .max(50, "slug ยาวได้ไม่เกิน 50 ตัวอักษร")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "ใช้ได้เฉพาะ a-z, 0-9 และขีดกลาง เช่น disney-plus");

/** URL ไม่บังคับ: ช่องว่าง → null */
const optionalUrl = z
  .string()
  .trim()
  .max(500, "ลิงก์ยาวเกินไป")
  .transform((v) => (v === "" ? null : v))
  .pipe(
    z.url({ protocol: /^https?$/, error: "ต้องเป็นลิงก์ที่ขึ้นต้นด้วย http:// หรือ https://" }).nullable(),
  )
  .nullable()
  .optional();

/** โลโก้: ลิงก์ http(s) หรือไฟล์ในเว็บเราเอง เช่น /logos/netflix.png (โลโก้ที่ seed ใส่ไว้) */
const optionalLogoUrl = z
  .string()
  .trim()
  .max(500, "ลิงก์ยาวเกินไป")
  .transform((v) => (v === "" ? null : v))
  .pipe(
    z
      .union(
        [
          z.url({ protocol: /^https?$/ }),
          z.string().regex(/^\/(?!\/)[\w\-./]+$/), // path ในเว็บ ห้าม // (จะกลายเป็นโดเมนอื่น)
        ],
        {
          error: "ต้องเป็นลิงก์ http:// หรือ https:// หรือไฟล์ในเว็บที่ขึ้นต้นด้วย / เช่น /logos/netflix.png",
        },
      )
      .nullable(),
  )
  .nullable()
  .optional();

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อหมวด").max(50, "ชื่อหมวดยาวได้ไม่เกิน 50 ตัวอักษร"),
  slug,
  icon: z.string().trim().max(50).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});
export const categoryUpdateSchema = categoryCreateSchema.partial();

export const serviceCreateSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อบริการ").max(100, "ชื่อบริการยาวได้ไม่เกิน 100 ตัวอักษร"),
  slug: slug.max(100),
  categoryId: z.coerce.number({ error: "กรุณาเลือกหมวด" }).int().positive("กรุณาเลือกหมวด"),
  logoUrl: optionalLogoUrl,
  websiteUrl: optionalUrl,
  cancelSteps: z
    .string()
    .trim()
    .min(1, "กรุณาใส่วิธียกเลิกอย่างน้อย 1 ขั้นตอน")
    .max(5000, "วิธียกเลิกยาวเกินไป"),
  isActive: z.boolean().optional(),
});
export const serviceUpdateSchema = serviceCreateSchema.partial();

/** ราคาบาท: ช่องว่างต้องเป็น error ไม่ใช่ 0 (z.coerce แปลง "" เป็น 0) */
export const priceSchema = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.coerce
    .number({ error: "กรุณากรอกราคา" })
    .min(0, "ราคาต้องเป็น 0 หรือมากกว่า")
    .max(99999.99, "ราคาสูงสุด 99,999.99 บาท")
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "ทศนิยมได้ไม่เกิน 2 ตำแหน่ง"),
);

export const planCreateSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อแพ็กเกจ").max(100, "ชื่อแพ็กเกจยาวได้ไม่เกิน 100 ตัวอักษร"),
  price: priceSchema,
  billingCycle: z.enum(["monthly", "yearly"], { error: "เลือกรอบบิลรายเดือนหรือรายปี" }),
  maxMembers: z.coerce.number().int().min(1, "อย่างน้อย 1 คน").max(20, "ไม่เกิน 20 คน").optional(),
  isActive: z.boolean().optional(),
});
export const planUpdateSchema = planCreateSchema.partial();

export type CategoryCreate = z.infer<typeof categoryCreateSchema>;
export type ServiceCreate = z.infer<typeof serviceCreateSchema>;
export type PlanCreate = z.infer<typeof planCreateSchema>;

/** แยกข้อความวิธียกเลิกเป็นขั้นตอน (1 บรรทัด = 1 ขั้น) ตัดบรรทัดว่างทิ้ง */
export function splitSteps(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}
