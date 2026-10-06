import { describe, expect, it } from "vitest";
import {
  billingDatesBetween,
  groupByDate,
  monthRange,
  occurrencesBetween,
  sumBilling,
  withinReminderWindow,
  type SchedulableItem,
} from "../schedule";

const item = (over: Partial<SchedulableItem> = {}): SchedulableItem => ({
  id: 1,
  name: "Netflix",
  logoUrl: null,
  price: 419,
  billingCycle: "monthly",
  nextBillingDate: "2026-10-09",
  billingAnchorDay: 9,
  trialEndsAt: null,
  status: "active",
  ...over,
});

describe("ฉายรายการลงปฏิทิน", () => {
  it("U-C1 รายเดือน anchor 31 ในเดือน ก.พ. ขึ้นวันสุดท้ายของเดือน", () => {
    const sub = item({ nextBillingDate: "2027-01-31", billingAnchorDay: 31 });
    const { from, to } = monthRange("2027-02");
    expect(billingDatesBetween(sub, from, to)).toEqual(["2027-02-28"]);
  });

  it("U-C2 รายปีที่ตัดเดือน มี.ค. ไม่ขึ้นในเดือน ต.ค.", () => {
    const sub = item({ billingCycle: "yearly", nextBillingDate: "2027-03-01", billingAnchorDay: 1 });
    const { from, to } = monthRange("2026-10");
    expect(billingDatesBetween(sub, from, to)).toEqual([]);
  });

  it("U-C3 ไม่ฉายย้อนก่อนวันตัดเงินถัดไป", () => {
    const sub = item({ nextBillingDate: "2026-11-09" });
    const { from, to } = monthRange("2026-10");
    expect(billingDatesBetween(sub, from, to)).toEqual([]);
  });

  it("U-C4 วันหมดทดลองขึ้นเป็นอีกชนิด และรายการที่ยกเลิกไม่ขึ้น", () => {
    const items = [
      item({ trialEndsAt: "2026-10-05", nextBillingDate: "2026-10-05", billingAnchorDay: 5 }),
      item({ id: 2, name: "HBO Max", status: "cancelled" }),
    ];
    const { from, to } = monthRange("2026-10");
    const result = occurrencesBetween(items, from, to);
    expect(result.map((r) => `${r.date} ${r.kind}`)).toEqual(["2026-10-05 billing", "2026-10-05 trial_end"]);
  });

  it("monthRange ได้วันแรก-วันสุดท้ายถูกต้องรวมปีอธิกสุรทิน", () => {
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
});

describe("D1-3 รายการ 7 วันข้างหน้า", () => {
  it("เรียงตามวัน และนับยอดเฉพาะการตัดเงิน", () => {
    const items = [
      item({ id: 1, nextBillingDate: "2026-10-12", billingAnchorDay: 12, price: 419 }),
      item({ id: 2, name: "Spotify", nextBillingDate: "2026-10-07", billingAnchorDay: 7, price: 249 }),
      item({ id: 3, name: "iCloud+", nextBillingDate: "2026-10-20", billingAnchorDay: 20, price: 99 }),
      item({
        id: 4,
        name: "YouTube",
        nextBillingDate: "2026-10-30",
        billingAnchorDay: 30,
        trialEndsAt: "2026-10-08",
      }),
    ];
    const upcoming = occurrencesBetween(items, "2026-10-07", "2026-10-14");
    expect(upcoming.map((u) => u.name)).toEqual(["Spotify", "YouTube", "Netflix"]);
    expect(sumBilling(upcoming)).toBe(668);
    expect(groupByDate(upcoming).map((g) => g.date)).toEqual(["2026-10-07", "2026-10-08", "2026-10-12"]);
  });
});

describe("U-R1 ช่วงแจ้งเตือน", () => {
  it("ตั้งไว้ 3 วัน: วันนี้และอีก 3 วันอยู่ในช่วง อีก 4 วันและเมื่อวานไม่อยู่", () => {
    expect(withinReminderWindow("2026-10-07", "2026-10-07", 3)).toBe(true);
    expect(withinReminderWindow("2026-10-07", "2026-10-10", 3)).toBe(true);
    expect(withinReminderWindow("2026-10-07", "2026-10-11", 3)).toBe(false);
    expect(withinReminderWindow("2026-10-07", "2026-10-06", 3)).toBe(false);
  });
});
