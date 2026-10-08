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

const THAI_WEEKDAY_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

const thaiParts = (date: Date, options: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { timeZone: BANGKOK, ...options })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );

/**
 * วันที่ปฏิทินแบบไทย: short = "ศ. 9 ต.ค." (สลิป/ปฏิทิน), medium = "9 ต.ค. 2569", long = "ศุกร์ 9 ตุลาคม 2569" (หน้ารายละเอียด/อีเมล)
 * รับ "YYYY-MM-DD" แล้วตีเป็นเที่ยงวันเวลาไทย จึงไม่เลื่อนวันไม่ว่าเครื่องตั้ง timezone อะไร
 */
export function formatThaiDate(iso: string, style: "short" | "medium" | "long" = "short"): string {
  const date = new Date(`${iso}T12:00:00+07:00`);
  if (style === "medium") {
    const p = thaiParts(date, { day: "numeric", month: "short", year: "numeric" });
    return `${p.day} ${p.month} ${p.year}`;
  }
  if (style === "short") {
    // ICU แสดงวันแบบย่อของไทยเป็นคำเต็ม ("ศุกร์") จึงใช้ตารางตัวย่อเอง
    const { y, m, d } = parseIsoDate(iso);
    const weekday = THAI_WEEKDAY_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return `${weekday} ${d} ${thaiParts(date, { month: "short" }).month}`;
  }
  const p = thaiParts(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `${p.weekday.replace(/^วัน/, "")} ${p.day} ${p.month} ${p.year}`;
}

/** timestamp (ISO UTC) → "7 ต.ค. 2569 22:15" ตามเวลาไทย */
export function formatThaiDateTime(isoTimestamp: string): string {
  const p = thaiParts(new Date(isoTimestamp), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${p.day} ${p.month} ${p.year} ${p.hour}:${p.minute}`;
}

/** ระยะเวลาถึงวันตัดเงินแบบที่คนพูด: "วันนี้", "พรุ่งนี้", "อีก 3 วัน" (ผ่านมาแล้ว: "เลยมา 2 วัน") */
export function relativeDayLabel(today: string, date: string): string {
  const days = daysBetween(today, date);
  if (days === 0) return "วันนี้";
  if (days === 1) return "พรุ่งนี้";
  if (days > 1) return `อีก ${days} วัน`;
  return `เลยมา ${-days} วัน`;
}

/** เดือนแบบไทยเต็ม: "2026-10" → "ตุลาคม 2569" */
export function formatThaiMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}
