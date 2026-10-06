import { nextCycleDate, type Cycle } from "./billing";
import { daysBetween, daysInMonth, toIsoDate } from "./dates";
import { fromSatang, toSatang } from "./money";

// ฉายรายการลงช่วงวันที่ — ใช้ร่วมกันทั้ง Dashboard (7 วันข้างหน้า), ปฏิทินรายเดือน และอีเมลทดสอบ (docs/02 ข้อ 3.3 ข้อ 6)

/** ข้อมูลขั้นต่ำของรายการที่ต้องใช้ฉาย (nextBillingDate ต้องเลื่อนให้ไม่อยู่ในอดีตแล้ว) */
export type SchedulableItem = {
  id: number;
  name: string;
  logoUrl: string | null;
  price: number;
  billingCycle: Cycle;
  nextBillingDate: string;
  billingAnchorDay: number;
  trialEndsAt: string | null;
  status: "active" | "cancelled";
};

export type UpcomingItem = {
  subscriptionId: number;
  name: string;
  logoUrl: string | null;
  date: string;
  amount: number;
  kind: "billing" | "trial_end";
};

/** ทุกวันที่ตัดเงินของรายการในช่วง [from, to] (รวมปลาย) — ไม่ฉายย้อนก่อน nextBillingDate */
export function billingDatesBetween(item: SchedulableItem, from: string, to: string): string[] {
  const dates: string[] = [];
  let date = item.nextBillingDate;
  while (date <= to) {
    if (date >= from) dates.push(date);
    date = nextCycleDate(date, item.billingCycle, item.billingAnchorDay);
  }
  return dates;
}

/** รายการ active ทั้งหมดที่ตัดเงินหรือหมดทดลองในช่วง [from, to] เรียงตามวัน (ตัดเงินก่อนหมดทดลองถ้าวันเดียวกัน) */
export function occurrencesBetween(items: SchedulableItem[], from: string, to: string): UpcomingItem[] {
  const out: UpcomingItem[] = [];
  for (const item of items) {
    if (item.status !== "active") continue;
    const base = { subscriptionId: item.id, name: item.name, logoUrl: item.logoUrl };
    for (const date of billingDatesBetween(item, from, to)) {
      out.push({ ...base, date, amount: item.price, kind: "billing" });
    }
    if (item.trialEndsAt && item.trialEndsAt >= from && item.trialEndsAt <= to) {
      out.push({ ...base, date: item.trialEndsAt, amount: item.price, kind: "trial_end" });
    }
  }
  return out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, "th"),
  );
}

/** ช่วงวันแรก–วันสุดท้ายของเดือน "YYYY-MM" */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  return { from: toIsoDate(y, m, 1), to: toIsoDate(y, m, daysInMonth(y, m)) };
}

/** จัดกลุ่มตามวัน สำหรับปฏิทิน — ส่งเฉพาะวันที่มีรายการ */
export function groupByDate(items: UpcomingItem[]): { date: string; items: UpcomingItem[] }[] {
  const map = new Map<string, UpcomingItem[]>();
  for (const it of items) map.set(it.date, [...(map.get(it.date) ?? []), it]);
  return [...map.entries()].map(([date, list]) => ({ date, items: list }));
}

/** ผลรวมยอดที่ "ตัดเงินจริง" ในชุดรายการ (ไม่นับวันหมดทดลองซ้ำ) */
export function sumBilling(items: UpcomingItem[]): number {
  return fromSatang(items.filter((i) => i.kind === "billing").reduce((s, i) => s + toSatang(i.amount), 0));
}

/** อยู่ในช่วงแจ้งเตือนหรือไม่: วันนี้ถึงอีก daysBefore วัน (ใช้ "ช่วง" ไม่ใช่วันพอดี เพื่อส่งย้อนได้ถ้าเครื่องปิดไป) */
export function withinReminderWindow(today: string, date: string, daysBefore: number): boolean {
  const d = daysBetween(today, date);
  return d >= 0 && d <= daysBefore;
}
