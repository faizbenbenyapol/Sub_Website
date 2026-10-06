import "server-only";
import { z } from "zod";

// ตรวจ environment variables ครั้งเดียวตอนโหลด ถ้าขาดตัวไหนให้พังทันทีพร้อมบอกชื่อ
const schema = z.object({
  DATABASE_URL: z.string().startsWith("mysql://"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร"),
  APP_URL: z.url(),
  MAIL_TRANSPORT: z.enum(["smtp", "console"]).default("console"),
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  CRON_ENABLED: z.stringbool().default(false),
  CRON_SECRET: z.string().min(16, "CRON_SECRET ต้องยาวอย่างน้อย 16 ตัวอักษร"),
});

/** อ่านและตรวจค่า env — โยน error ที่บอกชื่อตัวแปรที่ผิดถ้าตั้งค่าไม่ครบ */
function loadEnv() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`ตั้งค่า .env ไม่ครบ (ดู .env.example):\n${issues}`);
  }
  if (parsed.data.MAIL_TRANSPORT === "smtp" && (!parsed.data.SMTP_USER || !parsed.data.SMTP_PASS)) {
    throw new Error("MAIL_TRANSPORT=smtp ต้องตั้ง SMTP_USER และ SMTP_PASS");
  }
  return parsed.data;
}

export const env = loadEnv();
