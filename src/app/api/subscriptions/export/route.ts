import { toCsv } from "@/lib/csv";
import { todayInBangkok } from "@/lib/dates";
import { requireUser } from "@/server/auth";
import { api } from "@/server/http";
import { listSubscriptions } from "@/server/services/subscriptions";

const CYCLE = { monthly: "รายเดือน", yearly: "รายปี" } as const;
const STATUS = { active: "ใช้งานอยู่", cancelled: "ยกเลิกแล้ว" } as const;

/** ดาวน์โหลดรายการของฉันทั้งหมด (ใช้งานอยู่ + ยกเลิกแล้ว) เป็น CSV เปิดใน Excel ได้ (P2) */
export const GET = api(async () => {
  const user = await requireUser();
  const items = await listSubscriptions(user.id, "all");
  const today = todayInBangkok();
  const csv = toCsv([
    [
      "ชื่อบริการ",
      "แพ็กเกจ",
      "หมวด",
      "ราคา (บาท)",
      "รอบบิล",
      "ต่อเดือน (บาท)",
      "วันตัดเงินถัดไป",
      "วันหมดทดลองใช้",
      "ช่องทางจ่าย",
      "หมายเหตุ",
      "สถานะ",
    ],
    ...items.map((s) => [
      s.name,
      s.plan?.name ?? "",
      s.category.name,
      s.price,
      CYCLE[s.billingCycle],
      s.monthlyCost,
      s.status === "active" ? s.nextBillingDate : "",
      s.trialEndsAt,
      s.paymentMethod,
      s.note,
      STATUS[s.status],
    ]),
  ]);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="tadyang-subscriptions-${today}.csv"`,
      "cache-control": "no-store", // ข้อมูลส่วนตัว ไม่ให้ proxy/เบราว์เซอร์เก็บ
    },
  });
});
