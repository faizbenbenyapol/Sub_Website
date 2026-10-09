import { z } from "zod";

// schema ของ environment variables — แยกจาก env.ts (ที่เป็น server-only) ให้สคริปต์ preflight ใช้ตรวจชุดเดียวกับแอป

export const envSchema = z.object({
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
  // เข้าสู่ระบบด้วย Google (ไม่บังคับ) — ค่าว่างถือว่าไม่ได้ตั้ง ปุ่มจะไม่แสดง
  GOOGLE_CLIENT_ID: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  GOOGLE_CLIENT_SECRET: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  // ปุ่ม "ลองใช้ด้วยบัญชีตัวอย่าง" หน้า login (ไม่บังคับ) — ต้องเปิดเองและมีบัญชี DEMO_EMAIL ที่ seed ไว้แล้ว
  DEMO_LOGIN: z.stringbool().default(false),
  DEMO_EMAIL: z
    .string()
    .optional()
    .transform((v) => v?.trim().toLowerCase() || undefined),
});

export type Env = z.output<typeof envSchema>;

/** ตรวจค่า env — คืนรายการปัญหาเป็นข้อความ (ว่าง = ผ่าน) */
export function parseEnv(source: Record<string, string | undefined>): { env?: Env; issues: string[] } {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    return { issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  if (parsed.data.MAIL_TRANSPORT === "smtp" && (!parsed.data.SMTP_USER || !parsed.data.SMTP_PASS)) {
    return { issues: ["MAIL_TRANSPORT=smtp ต้องตั้ง SMTP_USER และ SMTP_PASS"] };
  }
  return { env: parsed.data, issues: [] };
}
