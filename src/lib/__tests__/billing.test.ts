import { describe, expect, it } from "vitest";
import { nextCycleDate, rollForward } from "../billing";
import { addDays, daysBetween, todayInBangkok } from "../dates";

describe("nextCycleDate — เลื่อนรอบบิลโดยยึด anchor day", () => {
  it("U-B1 anchor 31 ผ่านเดือนสั้นแล้วกลับมาวันที่ 31 ไม่ไหลเป็น 28", () => {
    const feb = nextCycleDate("2026-01-31", "monthly", 31);
    const mar = nextCycleDate(feb, "monthly", 31);
    const apr = nextCycleDate(mar, "monthly", 31);
    expect([feb, mar, apr]).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("U-B2 ปีอธิกสุรทินได้ 29 ก.พ.", () => {
    expect(nextCycleDate("2028-01-31", "monthly", 31)).toBe("2028-02-29");
  });

  it("U-B3 รายปีจาก 29 ก.พ. ได้ 28 ก.พ. ปีถัดไป", () => {
    expect(nextCycleDate("2028-02-29", "yearly", 29)).toBe("2029-02-28");
  });

  it("ข้ามปีจาก ธ.ค. ไป ม.ค.", () => {
    expect(nextCycleDate("2026-12-15", "monthly", 15)).toBe("2027-01-15");
  });
});

describe("rollForward — เลื่อนวันที่เลยมาแล้ว", () => {
  it("U-B4 เลยมาหลายรอบเลื่อนครั้งเดียวถึงรอบแรกที่ไม่อยู่ในอดีต", () => {
    expect(rollForward("2026-07-10", "monthly", 10, "2026-10-07")).toBe("2026-10-10");
  });

  it("U-B5 วันตัดเงินเท่ากับวันนี้ไม่เลื่อน", () => {
    expect(rollForward("2026-10-07", "monthly", 7, "2026-10-07")).toBe("2026-10-07");
  });

  it("รายปีที่เลยมาเลื่อนไปปีหน้า", () => {
    expect(rollForward("2026-03-01", "yearly", 1, "2026-10-07")).toBe("2027-03-01");
  });
});

describe("dates", () => {
  it("U-D1 01:30 เวลาไทยของวันที่ 7 ยังเป็นวันที่ 6 ตาม UTC แต่ระบบต้องได้วันที่ 7", () => {
    expect(todayInBangkok(new Date("2026-10-06T18:30:00Z"))).toBe("2026-10-07");
  });

  it("addDays ข้ามเดือนและปีได้", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("daysBetween นับวันได้ถูกและติดลบเมื่อย้อนหลัง", () => {
    expect(daysBetween("2026-10-07", "2026-10-10")).toBe(3);
    expect(daysBetween("2026-10-10", "2026-10-07")).toBe(-3);
  });
});
