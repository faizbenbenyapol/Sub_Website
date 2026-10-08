import { describe, expect, it } from "vitest";
import { safeNextPath } from "../safe-next";

describe("safeNextPath กัน open redirect หลังล็อกอิน", () => {
  it("รับ path ภายในพร้อม query/hash", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/calendar?month=2026-10#d")).toBe("/calendar?month=2026-10#d");
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "https://evil.com",
    "evil.com",
    "",
    null,
    undefined,
  ])("ปฏิเสธ %j", (next) => {
    expect(safeNextPath(next)).toBeNull();
  });
});
