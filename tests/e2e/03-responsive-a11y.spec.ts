import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, DEMO, expectNoHorizontalScroll, login } from "./helpers";

// S6 / N-1 / N-2 ทุกหน้าหลักที่ 1280 (project desktop) และ 375 (project mobile, แท็ก @mobile):
// ไม่มี scroll แนวนอน และ axe ไม่พบ violation ระดับ serious/critical

const PUBLIC_PAGES = ["/", "/services", "/services/netflix", "/login", "/register"];
const USER_PAGES = [
  "/dashboard",
  "/subscriptions",
  "/subscriptions/new",
  "/subscriptions/new?service=netflix",
  "/calendar",
  "/settings",
  "/notifications",
  "/groups",
  "/groups/new",
];
const ADMIN_PAGES = [
  "/admin",
  "/admin/categories",
  "/admin/services",
  "/admin/services/new",
  "/admin/users",
  "/admin/feedback",
];

/** ตรวจหน้าเดียว: โหลดสำเร็จ, ไม่มี scroll แนวนอน, ไม่มี violation ร้ายแรง */
async function audit(page: Page, path: string) {
  const res = await page.goto(path);
  expect(res?.status(), path).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  await expectNoHorizontalScroll(page);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const serious = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(" | ")}`,
    );
  expect(serious, `${path}\n${serious.join("\n")}`).toEqual([]);
}

test.describe("S6 responsive + a11y @mobile", () => {
  test("หน้า public", async ({ page }) => {
    for (const path of PUBLIC_PAGES) await audit(page, path);
  });

  test("หน้าผู้ใช้ (บัญชี demo)", async ({ page }) => {
    await login(page, DEMO);
    for (const path of USER_PAGES) await audit(page, path);
    // หน้าแก้รายการ + กลุ่มหาร + หน้าจ่ายเงิน ใช้ id จริงจากหน้ารายการ
    await page.goto("/subscriptions");
    const edit = await page
      .getByRole("link", { name: /Netflix/ })
      .first()
      .getAttribute("href");
    await audit(page, edit!);
    await page.goto("/groups");
    const group = page.locator('a[href^="/groups/"]:not([href="/groups/new"])').first();
    if (await group.count()) {
      const href = (await group.getAttribute("href"))!;
      await audit(page, href);
      const payUrl = await page.locator('a[href*="/pay/"]').first().getAttribute("href");
      if (payUrl) await audit(page, new URL(payUrl).pathname);
    }
  });

  test("หน้า admin", async ({ page }) => {
    await login(page, ADMIN);
    for (const path of ADMIN_PAGES) await audit(page, path);
    await page.goto("/admin/services");
    const detail = await page
      .locator('a[href^="/admin/services/"]:not([href$="/new"])')
      .first()
      .getAttribute("href");
    await audit(page, detail!);
  });
});

test("N-3 เพิ่มรายการด้วยคีย์บอร์ดล้วน", async ({ page }) => {
  await login(page, DEMO);
  await page.goto("/subscriptions/new");
  // ช่องค้นหา autoFocus → พิมพ์ → Tab ไปปุ่ม "เพิ่มเอง" → Enter
  await page.keyboard.type("ไม่มีแน่นอน");
  await expect(page.getByText(/ไม่พบ/)).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "ไม่มีในรวมบริการ? เพิ่มเอง" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("ชื่อบริการ")).toBeVisible();
  // focus ring มองเห็นได้
  await page.getByLabel("ชื่อบริการ").focus();
  const outline = await page.getByLabel("ชื่อบริการ").evaluate((el) => {
    const s = getComputedStyle(el);
    return `${s.outlineStyle} ${s.outlineWidth} ${s.boxShadow}`;
  });
  expect(outline).not.toBe("none 0px none");
});
