/** ตรวจว่า error มาจาก unique constraint ชน (MySQL ER_DUP_ENTRY) — drizzle อาจห่อ error เดิมไว้ใน cause */
export function isDuplicateKey(err: unknown): boolean {
  for (let e: unknown = err; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === "ER_DUP_ENTRY") return true;
  }
  return false;
}
