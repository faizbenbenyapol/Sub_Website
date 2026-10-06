import { z } from "zod";

// ข้อความ error เริ่มต้นของ zod เป็นภาษาไทย (ช่องไหนต้องการข้อความเฉพาะให้ระบุใน schema เอง)
z.config(z.locales.th());

export { z };

/** แปลง ZodError เป็น { ชื่อช่อง: ข้อความแรก } สำหรับ error.fields ของ API และใต้ช่องในฟอร์ม */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] ??= issue.message;
  }
  return fields;
}
