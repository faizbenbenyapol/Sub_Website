import { z } from "./index";

// รายงานปัญหา / คำแนะนำถึงผู้พัฒนา — ใช้ทั้งฟอร์มหน้าตั้งค่าและ API

export const FEEDBACK_KIND_LABEL = { bug: "แจ้งปัญหา", suggestion: "คำแนะนำ", other: "อื่น ๆ" } as const;
export const FEEDBACK_STATUS_LABEL = {
  new: "ใหม่",
  read: "อ่านแล้ว",
  acknowledged: "รับเรื่อง",
  in_progress: "กำลังแก้ไข",
  resolved: "แก้ไขเรียบร้อย",
} as const;

/** 3 ขั้นที่ผู้ใช้เห็นเป็นแถบความคืบหน้า (ใช้กับเรื่องที่ต้องแก้ เช่น ปัญหา/คำขอฟีเจอร์ — คำชมแค่ตอบกลับก็พอ) */
export const FEEDBACK_STEPS = ["acknowledged", "in_progress", "resolved"] as const;
export type FeedbackStatus = keyof typeof FEEDBACK_STATUS_LABEL;

export const feedbackCreateSchema = z.object({
  kind: z.enum(["bug", "suggestion", "other"], { error: "เลือกประเภท" }),
  message: z
    .string()
    .trim()
    .min(10, "เล่าเพิ่มอีกหน่อย อย่างน้อย 10 ตัวอักษร")
    .max(2000, "ยาวได้ไม่เกิน 2,000 ตัวอักษร"),
});
export type FeedbackCreate = z.infer<typeof feedbackCreateSchema>;

/** admin: เปลี่ยนสถานะ และ/หรือ ตอบกลับ (ต้องมีอย่างน้อยหนึ่งอย่าง) */
export const feedbackUpdateSchema = z
  .object({
    status: z
      .enum(["new", "read", "acknowledged", "in_progress", "resolved"], { error: "สถานะไม่ถูกต้อง" })
      .optional(),
    reply: z.string().trim().min(1, "พิมพ์คำตอบก่อนส่ง").max(2000, "ยาวได้ไม่เกิน 2,000 ตัวอักษร").optional(),
  })
  .refine((v) => v.status !== undefined || v.reply !== undefined, {
    error: "ต้องระบุ status หรือ reply",
    path: ["reply"],
  });
export type FeedbackUpdate = z.infer<typeof feedbackUpdateSchema>;
