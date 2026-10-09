// เงินในระบบ: DB เก็บ DECIMAL(10,2) อ่านออกมาเป็น string เช่น "419.00"
// คำนวณทุกอย่างเป็นสตางค์ (integer) เพื่อไม่ให้เจอ 0.1 + 0.2 = 0.30000000000000004

/** แปลงราคา (string จาก DB หรือ number จากฟอร์ม) เป็นสตางค์ */
export function toSatang(value: string | number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error(`ราคาไม่ถูกต้อง: ${value}`);
  return Math.round(n * 100);
}

/** สตางค์ → number บาท สำหรับส่งออก API */
export function fromSatang(satang: number): number {
  return satang / 100;
}

/** สตางค์ → string "419.00" สำหรับเขียนลง DECIMAL */
export function satangToDecimal(satang: number): string {
  return (satang / 100).toFixed(2);
}

/** ราคาจาก DB (string) → number บาท สำหรับ API */
export function decimalToNumber(value: string): number {
  return fromSatang(toSatang(value));
}

const bahtFormat = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** แสดงเงินแบบ "฿1,247.00" (ตาราง/สลิป) — short ตัด ".00" ทิ้งเมื่อเป็นจำนวนเต็ม (ในประโยค: "฿419" แต่ "฿66.50" ยังเต็ม) */
export function formatBaht(baht: number, opts: { short?: boolean } = {}): string {
  const s = bahtFormat.format(baht);
  return `฿${opts.short && Number.isInteger(baht) ? s.slice(0, -3) : s}`;
}

/** ยอดแบบย่อสำหรับที่แคบมาก (ช่องวันในปฏิทินบนมือถือ): 419 → "419", 1,200 → "1.2k", 12,990 → "13k" */
export function formatCompactBaht(baht: number): string {
  const whole = Math.round(baht); // ปัดก่อนเทียบ ไม่งั้น 999.5 ได้ "1000" แทน "1k"
  if (whole < 1000) return String(whole);
  if (baht < 10_000) return `${(Math.round(baht / 100) / 10).toString()}k`;
  return `${Math.round(baht / 1000)}k`;
}
