import { z } from "./index";

// schema ชุดเดียวใช้ทั้งฟอร์มฝั่ง client และ API ฝั่ง server

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("รูปแบบอีเมลไม่ถูกต้อง").max(191, "อีเมลยาวเกินไป"));

export const registerSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(100, "ชื่อยาวได้ไม่เกิน 100 ตัวอักษร"),
  email,
  password: z
    .string()
    .min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
    .max(72, "รหัสผ่านยาวได้ไม่เกิน 72 ตัวอักษร"), // bcrypt ใช้แค่ 72 byte แรก
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน").max(72),
});

const newPassword = z
  .string()
  .min(8, "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร")
  .max(72, "รหัสผ่านยาวได้ไม่เกิน 72 ตัวอักษร");

/** ขั้นแรกของการเปลี่ยนรหัส: ยืนยันรหัสเดิมก่อนปลดล็อกช่องรหัสใหม่ */
export const verifyPasswordSchema = z.object({
  currentPassword: z.string().min(1, "กรอกรหัสผ่านเดิม").max(72),
});

/** เปลี่ยนรหัสผ่าน (บัญชีที่เข้าด้วย Google อย่างเดียว ยังไม่มีรหัสเดิม จึงไม่ต้องส่ง currentPassword) */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().max(72).optional(),
    newPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    error: "รหัสผ่านใหม่สองช่องไม่ตรงกัน",
    path: ["confirmPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    error: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม",
    path: ["newPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
