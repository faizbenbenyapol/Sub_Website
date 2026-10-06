import { describe, expect, it } from "vitest";
import { decimalToNumber, formatBaht, satangToDecimal, toSatang } from "../money";

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
