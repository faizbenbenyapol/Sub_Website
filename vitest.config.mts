import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// สองชุดเทส (docs/04-test-plan.md ข้อ 2)
// - unit: ฟังก์ชัน pure ไม่แตะ DB รันเร็ว
// - integration: เรียก route handler จริงกับ MySQL `tadyang_test` (ต้อง `npm run db:up` ก่อน) รันทีละไฟล์เพราะใช้ DB ร่วมกัน

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "tests/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 60_000,
          // ค่าเฉพาะเทส ไม่ใช่ความลับ — แยก DB จาก dev และไม่ส่งอีเมลจริง
          env: {
            DATABASE_URL: "mysql://tadyang:tadyang@localhost:3307/tadyang_test",
            SESSION_SECRET: "integration-test-session-secret-0123456789abcdef",
            APP_URL: "http://localhost:3000",
            MAIL_TRANSPORT: "console",
            CRON_ENABLED: "false",
            CRON_SECRET: "integration-test-cron-secret",
            GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
            GOOGLE_CLIENT_SECRET: "test-google-secret",
            TZ: "UTC",
          },
        },
      },
    ],
  },
});
