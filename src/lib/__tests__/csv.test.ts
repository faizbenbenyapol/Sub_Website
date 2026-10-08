import { describe, expect, it } from "vitest";
import { csvCell, toCsv, UTF8_BOM } from "../csv";

describe("CSV", () => {
  it('ครอบ "" เมื่อมี , " หรือขึ้นบรรทัดใหม่', () => {
    expect(csvCell("Netflix")).toBe("Netflix");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('เขาว่า "ดี"')).toBe('"เขาว่า ""ดี"""');
    expect(csvCell("บรรทัด1\nบรรทัด2")).toBe('"บรรทัด1\nบรรทัด2"');
    expect(csvCell(null)).toBe("");
  });

  it("กันสูตร Excel: ข้อความขึ้นต้นด้วย = + - @ ใส่ ' นำหน้า แต่ตัวเลขติดลบยังเป็นตัวเลข", () => {
    expect(csvCell('=HYPERLINK("http://evil","คลิก")')).toBe('"\'=HYPERLINK(""http://evil"",""คลิก"")"');
    expect(csvCell("+66812345678")).toBe("'+66812345678");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell(-12.5)).toBe("-12.5");
  });

  it("ไฟล์มี BOM ขึ้นต้นและแถวคั่นด้วย CRLF", () => {
    expect(
      toCsv([
        ["ชื่อ", "ราคา"],
        ["ฟิตเนส", 590],
      ]),
    ).toBe(`${UTF8_BOM}ชื่อ,ราคา\r\nฟิตเนส,590\r\n`);
  });
});
