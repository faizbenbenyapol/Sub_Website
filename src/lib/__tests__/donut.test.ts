import { describe, expect, it } from "vitest";
import { shiftMonth } from "../dates";
import { ringSegments, roundPercents } from "../donut";
import { formatCompactBaht } from "../money";

describe("วงกลมสัดส่วน", () => {
  it("เปอร์เซ็นต์รวมได้ 100 พอดี และยอดรวม 0 ได้ 0 ทุกช่อง", () => {
    expect(roundPercents([1, 1, 1])).toEqual([34, 33, 33]);
    expect(roundPercents([618, 249, 99, 1200]).reduce((s, v) => s + v, 0)).toBe(100);
    expect(roundPercents([0, 0])).toEqual([0, 0]);
  });

  it("ชิ้นต่อกันรอบวง เว้นช่อง 2px เฉพาะเมื่อมีหลายชิ้น", () => {
    const one = ringSegments([5], 10);
    expect(one.segments[0].dash).toBeCloseTo(one.circumference);
    const two = ringSegments([1, 1], 10);
    expect(two.segments[1].offset).toBeCloseTo(two.circumference / 2);
    expect(two.segments[0].dash).toBeCloseTo(two.circumference / 2 - 2);
  });
});

describe("shiftMonth / formatCompactBaht", () => {
  it("เลื่อนเดือนข้ามปีได้ทั้งไปและถอย", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-10", 0)).toBe("2026-10");
  });

  it("999.5 ปัดแล้วเป็น 1k ไม่ใช่ 1000", () => {
    expect(formatCompactBaht(999.5)).toBe("1k");
    expect(formatCompactBaht(999.4)).toBe("999");
  });
});
