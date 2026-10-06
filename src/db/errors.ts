/** อ่าน error code ของ MySQL — drizzle อาจห่อ error เดิมไว้ใน cause หลายชั้น */
export function mysqlErrorCode(err: unknown): string | undefined {
  for (let e: unknown = err; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && code.startsWith("ER_")) return code;
  }
  return undefined;
}

/** unique constraint ชน (เช่น อีเมล/slug ซ้ำ) */
export function isDuplicateKey(err: unknown): boolean {
  return mysqlErrorCode(err) === "ER_DUP_ENTRY";
}

/** ลบแถวที่ยังมีตารางอื่นอ้างถึง (FK RESTRICT) */
export function isRowReferenced(err: unknown): boolean {
  return mysqlErrorCode(err) === "ER_ROW_IS_REFERENCED_2";
}

/** อ้าง FK ไปยังแถวที่ไม่มีอยู่ */
export function isMissingReference(err: unknown): boolean {
  return mysqlErrorCode(err) === "ER_NO_REFERENCED_ROW_2";
}
