import { expect, test } from "@playwright/test";
import { ADMIN, login } from "./helpers";

// S3 Admin แก้คลัง — ซ่อน Microsoft 365 (บัญชี demo ใช้อยู่ แต่ scenario อื่นไม่ได้แตะ) เพราะ project mobile รันหลัง desktop

test("S3 เพิ่มบริการ+แพ็กเกจ → แก้ราคา → ฝั่งผู้ใช้เห็น · ลบบริการที่มีคนใช้ → ซ่อนแทน → ผู้ใช้หาไม่เจอ", async ({
  page,
}) => {
  await login(page, ADMIN);

  // H5 dashboard admin แสดงตัวเลข
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // H2-1 / H3-1 เพิ่มบริการใหม่ + แพ็กเกจ
  await page.goto("/admin/services/new");
  await page.getByLabel("ชื่อบริการ").fill("Disney+ Hotstar");
  await page.getByLabel(/^slug/).fill("disney-hotstar-e2e");
  await page.getByLabel("หมวด").selectOption({ index: 1 });
  await page.getByLabel("วิธียกเลิก").fill("เข้าเมนูบัญชี\nกดยกเลิกการเป็นสมาชิก");
  await page.getByRole("button", { name: "เพิ่มบริการ" }).click();
  await expect(page).toHaveURL(/\/admin\/services\/\d+$/);
  await page.getByRole("button", { name: "เพิ่มแพ็กเกจ" }).click();
  const planDialog = page.getByRole("dialog");
  await planDialog.getByLabel("ชื่อแพ็กเกจ").fill("Premium");
  await planDialog.getByLabel("ราคา (บาท)").fill("289");
  await planDialog.getByRole("button", { name: "เพิ่มแพ็กเกจ" }).click();
  await expect(planDialog).toBeHidden();

  // H3-2 แก้ราคา → ประวัติราคา (ราคาใหม่โชว์ในตาราง + ฝั่งผู้ใช้)
  await page.getByRole("button", { name: "แก้ไข Premium" }).click();
  await page.getByRole("dialog").getByLabel("ราคา (บาท)").fill("299");
  await page.getByRole("dialog").getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }).click();
  await expect(page.getByRole("cell", { name: "฿299.00" })).toBeVisible();
  await page.goto("/services/disney-hotstar-e2e");
  await expect(page.getByText(/฿299/).first()).toBeVisible();
  await expect(page.getByText("กดยกเลิกการเป็นสมาชิก")).toBeVisible();

  // H2-2 ลบ Microsoft 365 (บัญชี demo ใช้อยู่) → dialog แนะนำให้ซ่อน → ซ่อน → ผู้ใช้หาไม่เจอ
  await page.goto("/admin/services?q=Microsoft");
  await page.getByRole("link", { name: "Microsoft 365" }).first().click();
  await page.getByRole("button", { name: "ลบ Microsoft 365" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ลบบริการ" }).click();
  await expect(page.getByRole("dialog")).toContainText("ลบ Microsoft 365 ไม่ได้");
  await page.getByRole("dialog").getByRole("button", { name: "ซ่อนบริการแทน" }).click();
  await expect(page.getByText("ซ่อน Microsoft 365 จากคลังบริการแล้ว")).toBeVisible();

  const res = await page.goto("/services/microsoft-365");
  expect(res?.status()).toBe(404);
  await page.goto("/services?q=microsoft");
  await expect(page.getByRole("link", { name: /Microsoft 365/ })).toHaveCount(0);
});
