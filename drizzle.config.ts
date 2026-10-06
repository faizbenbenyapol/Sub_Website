import { defineConfig } from "drizzle-kit";

// drizzle-kit ไม่โหลด .env เอง จึงใช้ตัวโหลดในตัวของ Node
try {
  process.loadEnvFile(".env");
} catch {
  // ไม่มีไฟล์ .env (เช่นบน CI) ให้ใช้ค่าจาก environment ตรง ๆ
}

export default defineConfig({
  dialect: "mysql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});
