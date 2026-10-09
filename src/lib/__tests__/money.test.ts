import { describe, expect, it } from "vitest";
import { decimalToNumber, formatBaht, formatCompactBaht, satangToDecimal, toSatang } from "../money";

describe("money", () => {
  it("U-M2 คิดเป็นสตางค์แล้วไม่มี float error", () => {
    expect(toSatang(0.1) + toSatang(0.2)).toBe(30);
    expect(satangToDecimal(toSatang("0.10") + toSatang("0.20"))).toBe("0.30");
  });

  it("แปลง string จาก DB เป็น number บาท", () => {
    expect(decimalToNumber("419.00")).toBe(419);
    expect(decimalToNumber("107.50")).toBe(107.5);
  });

  it("U-M4 formatBaht มีทศนิยม 2 ตำแหน่งและคั่นหลักพัน", () => {
    expect(formatBaht(1247)).toBe("฿1,247.00");
    expect(formatBaht(99999.99)).toBe("฿99,999.99");
    expect(formatBaht(0)).toBe("฿0.00");
    expect(formatBaht(1247, { short: true })).toBe("฿1,247");
  });

  it("ราคาที่ไม่ใช่ตัวเลขโยน error", () => {
    expect(() => toSatang("abc")).toThrow();
  });
});

describe("formatBaht แบบ short", () => {
  it("ตัด .00 เฉพาะจำนวนเต็ม", () => {
    expect(formatBaht(419, { short: true })).toBe("฿419");
    expect(formatBaht(66.5, { short: true })).toBe("฿66.50");
  });
});

describe("formatCompactBaht (ช่องวันในปฏิทินบนมือถือ)", () => {
  it("ต่ำกว่าพันแสดงเต็ม · หลักพันมีทศนิยม 1 ตำแหน่ง · หลักหมื่นขึ้นไปปัดเป็น k", () => {
    expect(formatCompactBaht(99)).toBe("99");
    expect(formatCompactBaht(419.5)).toBe("420");
    expect(formatCompactBaht(1000)).toBe("1k");
    expect(formatCompactBaht(1200)).toBe("1.2k");
    expect(formatCompactBaht(2999)).toBe("3k");
    expect(formatCompactBaht(12990)).toBe("13k");
  });
});
