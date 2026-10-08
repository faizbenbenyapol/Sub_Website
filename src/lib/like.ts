// คำค้นสำหรับ SQL LIKE — escape อักขระพิเศษให้ผู้ใช้ค้นหาตามตัวอักษรจริง ("100%" ไม่กลายเป็น wildcard)

/** "a_b" → "%a\_b%" (MySQL ใช้ \ เป็น escape ของ LIKE โดยปริยาย) */
export function containsPattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, "\\$&")}%`;
}
