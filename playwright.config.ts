import { defineConfig, devices } from "@playwright/test";

// E2E ตามลำดับ demo (docs/04-test-plan.md ข้อ 5) — ยิง production build (next build && next start) กับ DB `tadyang_e2e`
// แยกจาก dev (`tadyang`) และ integration (`tadyang_test`) · ต้อง `npm run db:up` ก่อน
// เบราว์เซอร์: ใช้ Edge ที่มากับ Windows (ไม่ต้องดาวน์โหลด) — เครื่องอื่น/CI ตั้ง PW_CHANNEL=chromium หลัง `npx playwright install chromium`

const PORT = 3200;
export const BASE_URL = `http://localhost:${PORT}`;

// ค่าเฉพาะ E2E ไม่ใช่ความลับ (บัญชีถูกสร้างใหม่ทุกครั้งที่รัน)
export const E2E_ENV = {
  DATABASE_URL: "mysql://tadyang:tadyang@localhost:3307/tadyang_e2e",
  SESSION_SECRET: "e2e-session-secret-0123456789abcdef0123456789",
  APP_URL: BASE_URL,
  MAIL_TRANSPORT: "console",
  CRON_ENABLED: "false",
  CRON_SECRET: "e2e-cron-secret-0123456789",
  ADMIN_EMAIL: "admin@e2e.local",
  ADMIN_PASSWORD: "e2e-admin-pass",
  DEMO_EMAIL: "demo@e2e.local",
  DEMO_PASSWORD: "e2e-demo-pass",
};

const channel = process.env.PW_CHANNEL ?? "msedge";
const browser = channel === "chromium" ? {} : { channel };

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1, // ใช้ DB ร่วมกัน และบาง scenario แก้คลังที่ scenario อื่นเห็น
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], ...browser, viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], ...browser, viewport: { width: 375, height: 812 } },
      grep: /@mobile/,
    },
  ],
  webServer: {
    // เตรียม DB ใหม่ทุกครั้ง (สร้าง → reset → seed) แล้ว build + start
    command: `npx tsx tests/e2e/create-db.ts && npx tsx scripts/reset.ts && npx tsx scripts/seed.ts && npx next build && npx next start -p ${PORT}`,
    url: `${BASE_URL}/api/health`,
    env: E2E_ENV,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI && process.env.PW_REUSE === "1",
    stdout: "ignore",
    stderr: "pipe",
  },
});
