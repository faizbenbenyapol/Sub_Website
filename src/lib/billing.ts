import { daysInMonth, parseIsoDate, toIsoDate } from "./dates";

// กฎเลื่อนรอบบิล (docs/02 ข้อ 3.3 ข้อ 2–3)

export type Cycle = "monthly" | "yearly";

/** วันที่ใช้เป็น anchor ของรอบบิล = วันที่ของวันตัดเงินที่ผู้ใช้กรอก */
export function anchorDayOf(iso: string): number {
  return parseIsoDate(iso).d;
}

/**
 * เลื่อนวันตัดเงินไปหนึ่งรอบ โดยยึด anchor day แล้ว clamp เป็นวันสุดท้ายของเดือนถ้าเดือนนั้นสั้นกว่า
 * เช่น anchor 31: 31 ม.ค. → 28 ก.พ. → 31 มี.ค. (ไม่ไหลไปเป็น 28 มี.ค.)
 */
export function nextCycleDate(iso: string, cycle: Cycle, anchorDay: number): string {
  const { y, m } = parseIsoDate(iso);
  const months = cycle === "monthly" ? 1 : 12;
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return toIsoDate(ny, nm, Math.min(anchorDay, daysInMonth(ny, nm)));
}

/** เลื่อนวันตัดเงินที่เลยมาแล้วไปจนถึงรอบแรกที่ >= วันนี้ (วันตัดเงิน = วันนี้ ไม่เลื่อน) */
export function rollForward(iso: string, cycle: Cycle, anchorDay: number, today: string): string {
  let date = iso;
  while (date < today) date = nextCycleDate(date, cycle, anchorDay);
  return date;
}
