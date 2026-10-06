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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
