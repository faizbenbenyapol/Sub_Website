import { formatBaht, fromSatang, toSatang } from "./money";

// ตัวช่วยประหยัด (US-G1) — สูตรล้วน คิดจากแพ็กเกจในคลัง ไม่ใช้ AI

export type SavingsPlan = {
  id: number;
  name: string;
  price: number;
  billingCycle: "monthly" | "yearly";
  maxMembers: number;
};
export type SavingsSubscription = {
  id: number;
  name: string;
  price: number;
  billingCycle: "monthly" | "yearly";
  planId: number | null;
  hasGroup: boolean;
};
export type SavingsSuggestion = {
  subscriptionId: number;
  kind: "switch_yearly" | "family_split";
  planId: number;
  members?: number;
  onSuggestedPlan: boolean; // ใช้แพ็กเกจที่เสนออยู่แล้ว (family_split → สร้างกลุ่มได้ทันที)
  saveMonthly: number;
  saveYearly: number;
  message: string;
};

const MIN_SAVE_SATANG = 100; // ประหยัดไม่ถึง ฿1/เดือน ไม่เสนอ (U-SV2)

const baht = (satang: number) => formatBaht(fromSatang(satang), { short: true });

/**
 * ข้อเสนอของรายการหนึ่ง (เฉพาะรายการรายเดือนจากคลัง):
 * - switch_yearly: บริการเดียวกันมีแพ็กเกจรายปีที่ ÷12 แล้วถูกกว่าที่จ่ายอยู่ (เลือกที่ประหยัดสุด)
 * - family_split: มีแพ็กเกจหลายคน → ถ้าหารเต็มจำนวนคน ส่วนต่อคนถูกกว่าที่จ่ายอยู่ (ไม่เสนอถ้ามีกลุ่มหารแล้ว)
 */
export function savingsFor(sub: SavingsSubscription, plans: SavingsPlan[]): SavingsSuggestion[] {
  if (sub.planId === null || sub.billingCycle !== "monthly") return [];
  const paying = toSatang(sub.price);
  const out: SavingsSuggestion[] = [];

  const yearly = plans
    .filter((p) => p.billingCycle === "yearly")
    .map((p) => ({ p, perMonth: Math.round(toSatang(p.price) / 12) }))
    .sort((a, b) => a.perMonth - b.perMonth)[0];
  if (yearly && paying - yearly.perMonth >= MIN_SAVE_SATANG) {
    // คิดยอดต่อปีตรง ๆ (ไม่เอาค่ารายเดือนที่ปัดเศษแล้วมาคูณ 12) จึงได้ ฿358 ไม่ใช่ ฿357.96
    const saveYear = paying * 12 - toSatang(yearly.p.price);
    out.push({
      subscriptionId: sub.id,
      kind: "switch_yearly",
      onSuggestedPlan: false,
      planId: yearly.p.id,
      saveMonthly: fromSatang(Math.round(saveYear / 12)),
      saveYearly: fromSatang(saveYear),
      message: `เปลี่ยน ${sub.name} เป็น ${yearly.p.name} จะประหยัดได้ ${baht(saveYear)}/ปี`,
    });
  }

  if (!sub.hasGroup) {
    const family = plans
      .filter((p) => p.billingCycle === "monthly" && p.maxMembers > 1)
      .map((p) => ({ p, perPerson: Math.ceil(toSatang(p.price) / p.maxMembers) }))
      .sort((a, b) => a.perPerson - b.perPerson)[0];
    if (family && paying - family.perPerson >= MIN_SAVE_SATANG) {
      const save = paying - family.perPerson;
      out.push({
        subscriptionId: sub.id,
        kind: "family_split",
        onSuggestedPlan: family.p.id === sub.planId,
        planId: family.p.id,
        members: family.p.maxMembers,
        saveMonthly: fromSatang(save),
        saveYearly: fromSatang(save * 12),
        message: `ถ้าใช้ ${family.p.name} หารกับเพื่อน ${family.p.maxMembers} คน จะเหลือคนละ ${baht(family.perPerson)}/เดือน`,
      });
    }
  }
  return out;
}
