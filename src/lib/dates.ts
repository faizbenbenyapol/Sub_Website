// วันที่ปฏิทินในระบบเป็น string "YYYY-MM-DD" ตามเวลาไทยเสมอ — ห้ามพึ่ง timezone ของเครื่อง (docs/02 ข้อ 6)

const BANGKOK = "Asia/Bangkok";

/** วันนี้ตามเวลาไทย เช่น 2026-10-07 (แม้เครื่องจะตั้งเป็น UTC) */
export function todayInBangkok(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BANGKOK }).format(now);
}

/** แยก "YYYY-MM-DD" เป็นตัวเลข */
export function parseIsoDate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

/** ประกอบตัวเลขกลับเป็น "YYYY-MM-DD" */
export function toIsoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** จำนวนวันในเดือน (m = 1–12) */
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** บวก/ลบจำนวนวัน คำนวณแบบ UTC ล้วนจึงไม่โดนเวลาออมแสงหรือ timezone ของเครื่อง */
export function addDays(iso: string, days: number): string {
  const { y, m, d } = parseIsoDate(iso);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return toIsoDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** จำนวนวันจาก from ถึง to (to หลัง from = บวก) */
export function daysBetween(from: string, to: string): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}
