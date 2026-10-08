import { describe, expect, it } from "vitest";
import {
  isValidThaiNationalId,
  maskPromptpayId,
  normalizePromptpayId,
  promptpayKind,
  promptpayPayload,
} from "../promptpay";
import { savingsFor, type SavingsPlan } from "../savings";
import { splitEqual, validateCustomSplit } from "../split";

/** CRC16-CCITT (poly 0x1021, init 0xFFFF) ตามมาตรฐาน EMVCo — เขียนแยกจากไลบรารีเพื่อตรวจไขว้ */
function crc16(s: string): string {
  let crc = 0xffff;
  for (const ch of Buffer.from(s, "ascii")) {
    crc ^= ch << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** แตก payload เป็น tag → value (TLV: tag 2 หลัก, ความยาว 2 หลัก) */
function tlv(payload: string): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < payload.length;) {
    const tag = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    map.set(tag, payload.slice(i + 4, i + 4 + len));
    i += 4 + len;
  }
  return map;
}

describe("U-P1/P2 payload พร้อมเพย์", () => {
  it("เบอร์โทร: dynamic QR, AID พร้อมเพย์, เบอร์แบบ 0066, สกุล THB, ยอด และ CRC ถูกต้อง", () => {
    const p = promptpayPayload("0812345678", 105);
    const t = tlv(p);
    expect(t.get("01")).toBe("12"); // 12 = QR ที่มียอดเงิน
    const merchant = tlv(t.get("29")!);
    expect(merchant.get("00")).toBe("A000000677010111");
    expect(merchant.get("01")).toBe("0066812345678");
    expect(t.get("58")).toBe("TH");
    expect(t.get("53")).toBe("764");
    expect(t.get("54")).toBe("105.00");
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });

  it("เลขบัตรประชาชนใช้ tag 02 ไม่ใช่ 01", () => {
    const p = promptpayPayload("1101700230708", 33.34);
    const merchant = tlv(tlv(p).get("29")!);
    expect(merchant.get("02")).toBe("1101700230708");
    expect(merchant.has("01")).toBe(false);
    expect(tlv(p).get("54")).toBe("33.34");
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });
});

describe("PromptPay ID", () => {
  it("ตัดขีด/ช่องว่างและแยกชนิดได้", () => {
    expect(normalizePromptpayId("081-234 5678")).toBe("0812345678");
    expect(promptpayKind("0812345678")).toBe("phone");
    expect(promptpayKind("1101700230708")).toBe("national_id");
    expect(promptpayKind("0212345678")).toBeNull(); // เบอร์บ้านใช้พร้อมเพย์ไม่ได้
    expect(promptpayKind("1101700230705")).toBeNull(); // check digit ผิด
  });

  it("ตรวจ check digit ของเลขบัตรประชาชน", () => {
    expect(isValidThaiNationalId("1101700230708")).toBe(true);
    expect(isValidThaiNationalId("1101700230705")).toBe(false);
  });

  it("U-P3 ปิดบังเลขก่อนแสดง", () => {
    expect(maskPromptpayId("0812345678")).toBe("08x-xxx-5678");
    expect(maskPromptpayId("1101700230708")).toBe("x-xxxx-xxxxx-70-8");
  });
});

describe("หารค่าบริการ", () => {
  it("U-S1 ฿419 หาร 4 (สมาชิก 3 + เจ้าของ)", () => {
    expect(splitEqual(41900, 3)).toEqual({ member: 10475, owner: 10475 });
  });

  it("U-S2 ฿100 หาร 3: เศษสตางค์ตกที่เจ้าของ ผลรวมเท่าราคา", () => {
    const { member, owner } = splitEqual(10000, 2);
    expect([member, owner]).toEqual([3333, 3334]);
    expect(member * 2 + owner).toBe(10000);
  });

  it("U-S3 กำหนดเอง: ผลรวมเกินราคาไม่ผ่าน", () => {
    expect(validateCustomSplit(10000, [6000, 5000])).toBe("ยอดของสมาชิกรวมกันเกินราคาแพ็กเกจ");
    expect(validateCustomSplit(10000, [5000, 5000])).toBeNull();
  });
});

describe("ตัวช่วยประหยัด", () => {
  const plans: SavingsPlan[] = [
    { id: 1, name: "Individual", price: 179, billingCycle: "monthly", maxMembers: 1 },
    { id: 2, name: "รายปี", price: 1790, billingCycle: "yearly", maxMembers: 1 },
    { id: 3, name: "Family", price: 299, billingCycle: "monthly", maxMembers: 6 },
  ];
  const sub = {
    id: 9,
    name: "YouTube",
    price: 179,
    billingCycle: "monthly" as const,
    planId: 1,
    hasGroup: false,
  };

  it("U-SV1 เสนอเปลี่ยนเป็นรายปีพร้อมยอดที่ประหยัด", () => {
    const yearly = savingsFor(sub, plans).find((s) => s.kind === "switch_yearly")!;
    expect(yearly.saveYearly).toBe(358);
    expect(yearly.message).toBe("เปลี่ยน YouTube เป็น รายปี จะประหยัดได้ ฿358/ปี");
  });

  it("เสนอหาร Family plan ถ้าถูกกว่า และไม่เสนอเมื่อมีกลุ่มหารแล้ว", () => {
    const family = savingsFor(sub, plans).find((s) => s.kind === "family_split")!;
    expect(family.members).toBe(6);
    expect(family.saveMonthly).toBe(129.16);
    expect(savingsFor({ ...sub, hasGroup: true }, plans).some((s) => s.kind === "family_split")).toBe(false);
  });

  it("U-SV2 ประหยัดไม่ถึง ฿1/เดือนไม่เสนอ และรายการรายปี/custom ไม่เสนอ", () => {
    const cheap = [{ id: 2, name: "รายปี", price: 2140, billingCycle: "yearly" as const, maxMembers: 1 }];
    expect(savingsFor(sub, cheap)).toEqual([]);
    expect(savingsFor({ ...sub, billingCycle: "yearly" }, plans)).toEqual([]);
    expect(savingsFor({ ...sub, planId: null }, plans)).toEqual([]);
  });
});
