import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_VERSION, RELEASES, userReleases } from "../changelog";

describe("ป้ายเวอร์ชัน", () => {
  it("ผู้ใช้ไม่เห็นรายการหลังบ้าน และเวอร์ชันที่มีแต่งานหลังบ้านไม่แสดง", () => {
    const releases = userReleases([
      ...RELEASES,
      {
        version: "0.9.0",
        date: "2026-10-01",
        title: "หลังบ้านล้วน",
        changes: [{ text: "ปรับ index", admin: true }],
      },
    ]);
    expect(releases.flatMap((r) => r.changes).some((c) => c.admin)).toBe(false);
    expect(releases.map((r) => r.version)).not.toContain("0.9.0");
  });

  it("แสดงแค่ 5 เวอร์ชันล่าสุด เวอร์ชันที่เก่ากว่านั้นหายไป", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      version: `1.${6 - i}.0`,
      date: `2026-10-0${7 - i}`,
      title: `v${i}`,
      changes: [{ text: `ข้อ ${i}` }],
    }));
    expect(userReleases(many).map((r) => r.version)).toEqual(["1.6.0", "1.5.0", "1.4.0", "1.3.0", "1.2.0"]);
  });

  it("เวอร์ชันบนสุดตรงกับ package.json และเรียงใหม่ → เก่า", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
    const dates = RELEASES.map((r) => r.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});
