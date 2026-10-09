import { expect, test } from "@playwright/test";
import { bangkokDate, DEMO, login, registerNewUser } from "./helpers";

// S1 happy path ผู้ใช้ใหม่ · S2 กันสิทธิ์ · S4 ยกเลิก/ลบ (docs/04-test-plan.md ข้อ 5)

test("S1 สมัคร → empty state → เพิ่มจากคลัง + เพิ่มเอง → dashboard/ปฏิทิน → อีเมลทดสอบ", async ({ page }) => {
  await registerNewUser(page, "มายด์");

  // D1-4 ผู้ใช้ใหม่เห็น empty state
  await page.getByRole("link", { name: "เพิ่มรายการแรก" }).click();
  await expect(page).toHaveURL(/\/subscriptions\/new/);

  // เพิ่ม Netflix จากคลัง → ราคาเติมจากแพ็กเกจแรก (Mobile ฿99)
  await page.getByLabel("ค้นหาจากรวมบริการ").fill("netf");
  await page.getByRole("button", { name: /Netflix/ }).click();
  await expect(page.getByLabel("ราคาที่จ่ายจริง (บาท)")).toHaveValue("99.00");
  await page.getByLabel("วันตัดเงินถัดไป", { exact: true }).fill(bangkokDate(3));
  await page.getByRole("button", { name: "เพิ่มรายการ" }).click();
  await expect(page).toHaveURL(/\/subscriptions$/);
  await expect(page.getByText("เพิ่ม Netflix แล้ว")).toBeVisible();

  // C1-3 ฟอร์มว่างแสดง error ใต้ช่อง · แล้วเพิ่มเอง
  await page.goto("/subscriptions/new");
  await page.getByRole("button", { name: "ไม่มีในรวมบริการ? เพิ่มเอง" }).click();
  await page.getByRole("button", { name: "เพิ่มรายการ" }).click();
  await expect(page.getByText("กรุณากรอกชื่อบริการ")).toBeVisible();
  await page.getByLabel("ชื่อบริการ").fill("ฟิตเนส");
  await page.getByLabel("ราคาที่จ่ายจริง (บาท)").fill("590");
  await page.getByLabel("วันตัดเงินถัดไป", { exact: true }).fill(bangkokDate(10));
  await page.getByRole("button", { name: "เพิ่มรายการ" }).click();
  await expect(page.getByText("เพิ่ม ฟิตเนส แล้ว")).toBeVisible();

  // D1-1 ยอดรวมต่อเดือน 99 + 590
  await page.goto("/dashboard");
  await expect(page.getByText("฿689.00").first()).toBeVisible();
  await expect(page.getByText("Netflix").first()).toBeVisible(); // ตัดในอีก 3 วัน → อยู่ในรายการ 7 วัน

  // D2-1 / D2-2 ปฏิทินเดือนของวันตัดเงิน: ช่องวันมีชื่อ+ยอดใน accessible name → กดแล้วเห็นรายละเอียด
  await page.goto(`/calendar?month=${bangkokDate(3).slice(0, 7)}`);
  const day = page.getByRole("link", { name: /Netflix รวม ฿99\.00/ });
  await day.click();
  await expect(day).toHaveAttribute("aria-current", "date");

  // E4-1 ส่งอีเมลทดสอบ (โหมด console): API สร้างอีเมล 2 รายการ · ผู้ใช้ทั่วไปเห็นข้อความภาษาธรรมดา ไม่ใช่เรื่อง log
  await page.goto("/settings");
  const testMail = page.waitForResponse("**/api/me/notifications/test");
  await page.getByRole("button", { name: "ส่งอีเมลทดสอบ" }).click();
  expect((await (await testMail).json()).data.itemCount).toBe(2);
  await expect(page.getByText("ตอนนี้ระบบยังไม่ได้เปิดการส่งอีเมลจริง")).toBeVisible();
  await expect(page.getByText("MAIL_TRANSPORT")).toHaveCount(0);
});

test("S2 ไม่ล็อกอิน → login พร้อม next · user เข้า /admin → 403 · ล็อกอินแล้วกลับหน้าเดิม", async ({
  page,
}) => {
  await page.goto("/subscriptions");
  await expect(page).toHaveURL(/\/login\?next=%2Fsubscriptions/);

  // security headers (กัน clickjacking / MIME sniffing) และไม่บอกว่าใช้ Next.js
  const headers = (await page.request.get("/login")).headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();

  // open redirect: ?next ที่ชี้ออกนอกเว็บถูกเปลี่ยนเป็นหน้าแรกของผู้ใช้
  await page.goto(`/login?next=${encodeURIComponent("/\t/evil.example")}`);
  await page.getByLabel("อีเมล").fill(DEMO.email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(DEMO.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/localhost:3200\/dashboard/);
  await page.context().clearCookies();

  const account = await registerNewUser(page);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "หน้านี้สำหรับผู้ดูแลระบบ" })).toBeVisible();
  await expect(page.getByRole("link", { name: "หลังบ้าน" })).toHaveCount(0);

  await page.context().clearCookies();
  await page.goto("/calendar");
  await expect(page).toHaveURL(/\/login\?next=%2Fcalendar/);
  await page.getByLabel("อีเมล").fill(account.email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/calendar/);
});

test("A2-1 รหัสผิดเห็นข้อความกลาง ๆ", async ({ page }) => {
  await login(page, { email: "demo@e2e.local", password: "e2e-demo-pass" });
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill("demo@e2e.local");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page.getByText("อีเมลหรือรหัสผ่านไม่ถูกต้อง")).toBeVisible();
});

test("S4 ยกเลิก → ย้ายแท็บ ยอดลด → ลบต้องยืนยัน → หาย", async ({ page }) => {
  await registerNewUser(page);
  await page.goto("/subscriptions/new");
  await page.getByRole("button", { name: "ไม่มีในรวมบริการ? เพิ่มเอง" }).click();
  await page.getByLabel("ชื่อบริการ").fill("ค่าเน็ตบ้าน");
  await page.getByLabel("ราคาที่จ่ายจริง (บาท)").fill("650");
  await page.getByLabel("วันตัดเงินถัดไป", { exact: true }).fill(bangkokDate(5));
  await page.getByRole("button", { name: "เพิ่มรายการ" }).click();
  await expect(page.getByText("เพิ่ม ค่าเน็ตบ้าน แล้ว")).toBeVisible();

  await page.getByRole("link", { name: /ค่าเน็ตบ้าน/ }).click();
  await page.getByRole("button", { name: "ยกเลิกรายการ" }).click();
  const cancelDialog = page.getByRole("dialog");
  await expect(cancelDialog).toContainText("ยกเลิก ค่าเน็ตบ้าน?");
  await cancelDialog.getByRole("button", { name: "ยกเลิกรายการ" }).click();
  await expect(page).toHaveURL(/status=cancelled/);
  await expect(page.getByRole("link", { name: /ค่าเน็ตบ้าน/ })).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "เพิ่มรายการแรก" })).toBeVisible(); // ไม่มีรายการ active แล้ว

  // C2-3 กด "ไม่ลบ" แล้วยังอยู่ → ลบจริง
  await page.goto("/subscriptions?status=cancelled");
  await page.getByRole("link", { name: /ค่าเน็ตบ้าน/ }).click();
  await page.getByRole("button", { name: "ลบรายการ" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ไม่ลบ" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "ลบรายการ" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ลบรายการ" }).click();
  await expect(page.getByText("ลบ ค่าเน็ตบ้าน แล้ว")).toBeVisible();
  await page.goto("/subscriptions?status=all");
  await expect(page.getByRole("link", { name: /ค่าเน็ตบ้าน/ })).toHaveCount(0);
});
