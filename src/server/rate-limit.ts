import "server-only";

// ตัวนับในหน่วยความจำ — พอสำหรับเซิร์ฟเวอร์ process เดียว (รีสตาร์ตแล้วนับใหม่)
const buckets = new Map<string, { count: number; resetAt: number }>();

/** นับครั้งของ key ภายในช่วงเวลา คืน true ถ้ายังไม่เกิน limit */
export function hit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/** ดูว่า key เกิน limit แล้วหรือยัง โดยไม่เพิ่มตัวนับ */
export function isLimited(key: string, limit: number, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  return !!bucket && bucket.resetAt > now && bucket.count >= limit;
}

/** ล้างตัวนับ เช่น หลังล็อกอินสำเร็จ */
export function reset(key: string) {
  buckets.delete(key);
}
