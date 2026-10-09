// คณิตของวงกลมสัดส่วน ใช้ร่วมกันระหว่างหน้าภาพรวม (DonutChart) และรายงาน PDF — ให้ % และรูปวงตรงกันทุกที่

/** แปลงยอดเป็นเปอร์เซ็นต์จำนวนเต็มที่รวมได้ 100 พอดี (largest remainder) · ยอดรวมเป็น 0 ได้ 0 ทุกช่อง */
export function roundPercents(values: number[]): number[] {
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const floor = raw.map(Math.floor);
  let left = 100 - floor.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => [v - floor[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left-- <= 0) break;
    floor[i] += 1;
  }
  return floor;
}

/**
 * ความยาวเส้นและจุดเริ่มของแต่ละชิ้นบนวง (ใช้กับ stroke-dasharray / stroke-dashoffset ของ <circle>)
 * เว้นช่อง gap px ระหว่างชิ้นเมื่อมีมากกว่า 1 ชิ้น · ชิ้นเล็กมากยังเห็นอย่างน้อย 0.5px
 */
export function ringSegments(values: number[], radius: number, gap = 2) {
  const circumference = 2 * Math.PI * radius;
  const total = values.reduce((s, v) => s + v, 0);
  const lengths = values.map((v) => (total > 0 ? (v / total) * circumference : 0));
  const space = values.length > 1 ? gap : 0;
  return {
    circumference,
    segments: lengths.map((length, i) => ({
      dash: Math.max(length - space, 0.5),
      offset: lengths.slice(0, i).reduce((s, l) => s + l, 0), // เริ่มต่อจากชิ้นก่อนหน้าทั้งหมด
    })),
  };
}
