import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// A3-7 (docs/04-test-plan.md): ทุก route ใน src/app/api ที่ไม่ได้ประกาศว่าเป็น public ต้องตรวจสิทธิ์
// เป็นการตรวจซอร์สโค้ดแบบ static จึงจับ route ใหม่ที่ลืมใส่ requireUser ได้ตั้งแต่ยังไม่มีเทส integration

const API_DIR = join(process.cwd(), "src", "app", "api");

// route ที่ตั้งใจให้เรียกได้โดยไม่ล็อกอิน (🌐 ใน docs/02 ข้อ 5) — เพิ่มที่นี่เท่านั้นเมื่อ contract บอกว่า public
const PUBLIC_ROUTES = new Set([
  "health",
  "auth/register",
  "auth/login",
  "auth/logout",
  "auth/demo", // ปุ่มบัญชีตัวอย่าง: เปิดเฉพาะ DEMO_LOGIN=true และได้แค่บัญชี role user
  "auth/google",
  "auth/google/callback",
  "categories",
  "services",
  "services/[slug]",
  "plans/[id]/price-history",
]);

/** หาไฟล์ route.ts ทุกไฟล์ใต้ src/app/api */
function findRoutes(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return findRoutes(path);
    return name === "route.ts" ? [path] : [];
  });
}

const routes = findRoutes(API_DIR).map((file) => ({
  file,
  route: relative(API_DIR, file).split(sep).slice(0, -1).join("/"),
}));

describe("A3-7 ทุก API route ที่ไม่ใช่ public ต้องตรวจสิทธิ์", () => {
  it("หา route เจอ", () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  for (const { file, route } of routes.filter((r) => !PUBLIC_ROUTES.has(r.route))) {
    it(`/api/${route} เรียก requireUser / requireAdmin / ตรวจ CRON_SECRET`, () => {
      const source = readFileSync(file, "utf8");
      const guarded = route.startsWith("admin/")
        ? /requireAdmin\(/.test(source)
        : /require(User|Admin)\(|CRON_SECRET/.test(source);
      expect(guarded, `${file} ไม่มีการตรวจสิทธิ์`).toBe(true);
    });
  }

  it("ทุก route ห่อด้วย api() เพื่อให้ error format เดียวกันและตรวจ origin", () => {
    const unwrapped = routes.filter(
      ({ file }) => !/export const (GET|POST|PUT|PATCH|DELETE) = api[<(]/.test(readFileSync(file, "utf8")),
    );
    // health เป็นข้อยกเว้นเดียว: ต้องตอบได้แม้ชั้น api() มีปัญหา
    expect(unwrapped.map((r) => r.route)).toEqual(["health"]);
  });
});
