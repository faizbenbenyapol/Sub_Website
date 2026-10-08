import generatePayload from "promptpay-qr";

// PromptPay ID: เบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน 13 หลัก (docs/02 ข้อ 3.2 share_groups.promptpay_id)

export type PromptpayKind = "phone" | "national_id";

/** เอาเฉพาะตัวเลข (ผู้ใช้อาจพิมพ์ 081-234-5678 หรือมีช่องว่าง) */
export function normalizePromptpayId(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** เลขบัตรประชาชนไทย: หลักสุดท้ายเป็น check digit ของ 12 หลักแรก */
export function isValidThaiNationalId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  const sum = [...id.slice(0, 12)].reduce((s, d, i) => s + Number(d) * (13 - i), 0);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}

/** ชนิดของ ID ที่ถูกต้อง หรือ null ถ้าใช้ไม่ได้ */
export function promptpayKind(id: string): PromptpayKind | null {
  if (/^0[689]\d{8}$/.test(id)) return "phone";
  if (isValidThaiNationalId(id)) return "national_id";
  return null;
}

/** ปิดบังเลขก่อนแสดงบนหน้าที่คนอื่นเห็น: 08x-xxx-5678 / x-xxxx-xxxxx-12-3 */
export function maskPromptpayId(id: string): string {
  if (id.length === 10) return `${id.slice(0, 2)}x-xxx-${id.slice(6)}`;
  if (id.length === 13) return `x-xxxx-xxxxx-${id.slice(10, 12)}-${id[12]}`;
  return "x".repeat(id.length);
}

/** payload ตามมาตรฐาน EMVCo ที่แอปธนาคารสแกนแล้วขึ้นชื่อผู้รับและยอด (ยอดเป็นบาท ทศนิยม 2 ตำแหน่ง) */
export function promptpayPayload(id: string, amount: number): string {
  return generatePayload(id, { amount: Math.round(amount * 100) / 100 });
}
