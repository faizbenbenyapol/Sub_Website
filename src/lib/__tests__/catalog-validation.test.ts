import { describe, expect, it } from "vitest";
import { serviceCreateSchema } from "../validation/catalog";

describe("logoUrl ของบริการ", () => {
  const logo = serviceCreateSchema.shape.logoUrl;

  it("รับลิงก์ https และไฟล์ในเว็บ (/logos/...) · ช่องว่างเป็น null", () => {
    expect(logo.parse("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(logo.parse("/logos/netflix.svg")).toBe("/logos/netflix.svg");
    expect(logo.parse("")).toBeNull();
  });

  it("ไม่รับ // (ลิงก์ไปโดเมนอื่น), javascript: และ path ที่มีอักขระแปลก", () => {
    expect(logo.safeParse("//evil.example/x.png").success).toBe(false);
    expect(logo.safeParse("javascript:alert(1)").success).toBe(false);
    expect(logo.safeParse("/logos/a b.png").success).toBe(false);
  });
});
