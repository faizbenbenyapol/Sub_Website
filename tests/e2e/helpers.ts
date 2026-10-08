import { expect, type Page } from "@playwright/test";
import { E2E_ENV } from "../../playwright.config";

// helper ของ E2E — บัญชี admin/demo มาจาก seed ที่รันตอนเริ่ม webServer

export const ADMIN = { email: E2E_ENV.ADMIN_EMAIL, password: E2E_ENV.ADMIN_PASSWORD };
export const DEMO = { email: E2E_ENV.DEMO_EMAIL, password: E2E_ENV.DEMO_PASSWORD };

/** วันที่ไทยนับจากวันนี้ (YYYY-MM-DD) */
export function bangkokDate(daysFromToday = 0): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

/** ล็อกอินผ่านฟอร์มจริง แล้วรอให้ออกจากหน้า login */
export async function login(page: Page, account: { email: string; password: string }, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("อีเมล").fill(account.email);
  await page.getByLabel("รหัสผ่าน").fill(account.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** สมัครผู้ใช้ใหม่ที่อีเมลไม่ซ้ำ คืนข้อมูลบัญชี */
export async function registerNewUser(page: Page, name = "ผู้ใช้ทดสอบ") {
  const account = {
    email: `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@e2e.local`,
    password: "e2e-pass-123",
  };
  await page.goto("/register");
  await page.getByLabel("ชื่อ").fill(name);
  await page.getByLabel("อีเมล").fill(account.email);
  await page.getByLabel("รหัสผ่าน").fill(account.password);
  await page.getByRole("button", { name: "สมัครและเข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return account;
}

/** หน้าไม่มี scroll แนวนอน (docs/04 N-1) */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `เลื่อนแนวนอนได้ ${overflow}px ที่ ${page.url()}`).toBeLessThanOrEqual(0);
}
