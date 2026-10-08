import { expect, test } from "@playwright/test";
import { DEMO, login } from "./helpers";

// S5 หารค่าบริการ (P1) — สร้างกลุ่ม → คนนอกเปิดลิงก์จ่ายโดยไม่ล็อกอิน → เจ้าของกดจ่ายแล้ว → หน้าจ่ายเปลี่ยนสถานะ

test("S5 สร้างกลุ่ม → หน้าจ่ายของสมาชิก (ไม่ล็อกอิน) → กดจ่ายแล้ว", async ({ page, browser }) => {
  await login(page, DEMO);
  await page.goto("/groups/new");
  await page.getByLabel("PromptPay ID ของคุณ (รับเงิน)").fill("0812345678");
  await page.getByLabel("ชื่อคนที่ 1").fill("บอล");
  await page.getByRole("button", { name: "+ เพิ่มสมาชิก" }).click();
  await page.getByLabel("ชื่อคนที่ 2").fill("เมย์");
  await page.getByRole("button", { name: "สร้างกลุ่มหาร" }).click();
  await expect(page).toHaveURL(/\/groups\/\d+$/);
  await expect(page.getByText("08x-xxx-5678")).toBeVisible();
  await expect(page.getByText("0812345678")).toHaveCount(0);

  const payUrl = await page.getByRole("link", { name: /เปิดหน้าจ่าย ของ บอล/ }).getAttribute("href");
  expect(payUrl).toMatch(/\/pay\/[A-Za-z0-9_-]{43}$/);

  // F2-1 / F2-3 คนนอก: context ใหม่ไม่มี cookie
  const guest = await browser.newContext();
  const pay = await guest.newPage();
  await pay.goto(payUrl!);
  await expect(pay.getByRole("heading", { level: 1 })).toContainText("ขอเก็บค่า");
  await expect(pay.getByText("ส่วนของบอล")).toBeVisible();
  await expect(pay.locator("svg").first()).toBeVisible();
  await expect(pay.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(pay.getByText("เมย์")).toHaveCount(0);
  await expect(pay.getByText("จ่ายแล้ว")).toHaveCount(0);

  // F3-1 เจ้าของกดจ่ายแล้ว → หน้าจ่ายเห็นสถานะใหม่
  await page.getByRole("button", { name: /ยังไม่จ่าย.*บอล|บอล.*ยังไม่จ่าย/ }).click();
  await expect(page.getByText("บอล จ่ายแล้ว")).toBeVisible();
  await pay.reload();
  await expect(pay.getByText("จ่ายแล้ว").first()).toBeVisible();

  // F2-2 token มั่ว → 404
  const res = await pay.goto("/pay/" + "x".repeat(43));
  expect(res?.status()).toBe(404);
  await guest.close();
});
