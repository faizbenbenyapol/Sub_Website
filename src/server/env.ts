import "server-only";
import { parseEnv } from "./env-schema";

// ตรวจ environment variables ครั้งเดียวตอนโหลด ถ้าขาดตัวไหนให้พังทันทีพร้อมบอกชื่อ (schema อยู่ใน env-schema.ts)

/** อ่านและตรวจค่า env — โยน error ที่บอกชื่อตัวแปรที่ผิดถ้าตั้งค่าไม่ครบ */
function loadEnv() {
  const { env, issues } = parseEnv(process.env);
  if (!env) {
    throw new Error(`ตั้งค่า .env ไม่ครบ (ดู .env.example):\n${issues.map((i) => `  - ${i}`).join("\n")}`);
  }
  return env;
}

export const env = loadEnv();

/** เปิดปุ่มลองบัญชีตัวอย่างหน้า login หรือไม่ */
export const demoLoginEnabled = Boolean(env.DEMO_LOGIN && env.DEMO_EMAIL);

/** ตั้งค่า Google OAuth ครบทั้งคู่หรือยัง */
export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
