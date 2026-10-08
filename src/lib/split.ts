// หารค่าบริการ (docs/02 ข้อ 3.3 ข้อ 7) — คิดเป็นสตางค์ทั้งหมด

/**
 * หารเท่ากันระหว่างสมาชิก + เจ้าของ: สมาชิกได้ floor ทุกคน เศษสตางค์ตกที่เจ้าของ
 * เช่น ฿100 หาร 3 → สมาชิก 33.33 สองคน เจ้าของ 33.34
 */
export function splitEqual(totalSatang: number, memberCount: number): { member: number; owner: number } {
  const share = Math.floor(totalSatang / (memberCount + 1));
  return { member: share, owner: totalSatang - share * memberCount };
}

/** โหมดกำหนดเอง: ผลรวมของสมาชิกต้องไม่เกินราคา (ส่วนที่เหลือเป็นของเจ้าของ) */
export function validateCustomSplit(totalSatang: number, memberSatang: number[]): string | null {
  if (memberSatang.some((s) => s < 0)) return "ยอดของสมาชิกต้องไม่ติดลบ";
  const sum = memberSatang.reduce((a, b) => a + b, 0);
  if (sum > totalSatang) return "ยอดของสมาชิกรวมกันเกินราคาแพ็กเกจ";
  return null;
}
