import "server-only";
import { addDays } from "@/lib/dates";
import { fromSatang, toSatang } from "@/lib/money";
import { groupByDate, monthRange, occurrencesBetween, type UpcomingItem } from "@/lib/schedule";
import { listSubscriptions } from "./subscriptions";

// Dashboard และปฏิทินของผู้ใช้ (US-D1, D2) — คำนวณจากรายการ active ด้วย lib/schedule.ts

export const UPCOMING_DAYS = 7;

export type DashboardDto = {
  totals: { monthly: number; yearly: number; activeCount: number };
  byCategory: { categoryId: number; name: string; monthly: number }[];
  upcoming: UpcomingItem[];
};

/** ภาพรวมค่าใช้จ่าย: ยอดต่อเดือน/ปี, สัดส่วนตามหมวด (มาก→น้อย), รายการใน 7 วันข้างหน้ารวมวันนี้ */
export async function getDashboard(userId: number, today: string): Promise<DashboardDto> {
  const items = await listSubscriptions(userId, "active");
  const byCategory = new Map<number, { name: string; satang: number }>();
  let monthlySatang = 0;
  for (const s of items) {
    const m = toSatang(s.monthlyCost);
    monthlySatang += m;
    const entry = byCategory.get(s.category.id) ?? { name: s.category.name, satang: 0 };
    entry.satang += m;
    byCategory.set(s.category.id, entry);
  }
  return {
    totals: {
      monthly: fromSatang(monthlySatang),
      yearly: fromSatang(monthlySatang * 12),
      activeCount: items.length,
    },
    byCategory: [...byCategory.entries()]
      .map(([categoryId, v]) => ({ categoryId, name: v.name, monthly: fromSatang(v.satang) }))
      .sort((a, b) => b.monthly - a.monthly),
    upcoming: occurrencesBetween(items, today, addDays(today, UPCOMING_DAYS)),
  };
}

/** ปฏิทินรายเดือน: วันที่มีรายการตัดเงิน/หมดทดลอง (ไม่ฉายย้อนก่อนวันนี้) */
export async function getCalendar(userId: number, month: string, today: string) {
  const items = await listSubscriptions(userId, "active");
  const { from, to } = monthRange(month);
  const start = from < today ? today : from;
  return { month, days: start > to ? [] : groupByDate(occurrencesBetween(items, start, to)) };
}
