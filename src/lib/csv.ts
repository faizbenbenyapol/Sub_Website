// สร้างไฟล์ CSV ที่เปิดใน Excel แล้วภาษาไทยไม่เพี้ยน และกันสูตรอันตราย (CSV/formula injection)

/** BOM ทำให้ Excel รู้ว่าเป็น UTF-8 — ไม่มีแล้วภาษาไทยกลายเป็นตัวอักษรแปลก ๆ */
export const UTF8_BOM = "﻿";

/**
 * แปลงค่าหนึ่งช่อง: ข้อความที่ขึ้นต้นด้วย = + - @ tab หรือ CR ใส่ ' นำหน้า (Excel จะไม่รันเป็นสูตร)
 * แล้วครอบ "" เมื่อมี , " หรือขึ้นบรรทัดใหม่ — ตัวเลขส่งตรง ๆ จึงยังติดลบได้ตามปกติ
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** หลายแถวเป็นไฟล์ CSV (CRLF ตามมาตรฐาน RFC 4180) พร้อม BOM */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return UTF8_BOM + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
