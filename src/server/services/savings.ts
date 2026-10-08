import "server-only";
import { listSubscriptions } from "./subscriptions";
import { plansByService } from "./catalog";
import { decimalToNumber } from "@/lib/money";
import { savingsFor, type SavingsSuggestion } from "@/lib/savings";

/** ข้อเสนอประหยัดทุกข้อของผู้ใช้ (US-G1) เรียงจากประหยัดต่อปีมากที่สุด */
export async function getSavings(userId: number): Promise<SavingsSuggestion[]> {
  const subs = await listSubscriptions(userId, "active");
  const planMap = await plansByService(subs.flatMap((s) => (s.service ? [s.service.id] : [])));
  return subs
    .flatMap((s) => {
      if (!s.service) return [];
      const plans = (planMap.get(s.service.id) ?? [])
        .filter((p) => p.isActive)
        .map((p) => ({
          id: p.id,
          name: p.name,
          price: decimalToNumber(p.price),
          billingCycle: p.billingCycle,
          maxMembers: p.maxMembers,
        }));
      return savingsFor(
        {
          id: s.id,
          name: s.name,
          price: s.price,
          billingCycle: s.billingCycle,
          planId: s.plan?.id ?? null,
          hasGroup: s.groupId !== null,
        },
        plans,
      );
    })
    .sort((a, b) => b.saveYearly - a.saveYearly);
}
