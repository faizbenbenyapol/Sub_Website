// ป้องกัน open redirect หลังล็อกอิน (?next=) — รับเฉพาะ path ภายในเว็บเดียวกัน

const BASE = "http://internal.invalid";

/**
 * คืน path ภายในที่ปลอดภัย หรือ null ถ้าเป็นลิงก์ออกนอกเว็บ
 * ปฏิเสธ "//evil", "/\evil", "/<TAB>/evil" (เบราว์เซอร์ตีความเป็นโดเมนอื่น) และอักขระควบคุมทั้งหมด
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return null;
  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
