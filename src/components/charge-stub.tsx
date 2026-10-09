import Link from "next/link";
import { daysBetween, formatThaiDate, relativeDayLabel } from "@/lib/dates";
import { formatBaht } from "@/lib/money";
import type { UpcomingItem } from "@/lib/schedule";
import { ServiceLogo } from "./service-logo";

/**
 * "สลิปตัดเงิน" (docs/03 ข้อ 1) — ต้นขั้วใบเสร็จที่มีเส้นปรุคั่น ซ้ายคือบริการ ขวาคือวันและยอด
 * ใช้เฉพาะรายการที่กำลังจะตัดเงิน (Dashboard, ปฏิทิน) เพื่อให้รูปทรงนี้แปลว่า "จะโดนตัดเงิน" เสมอ
 * ฝั่งขวากว้างขั้นต่ำเท่ากันทุกใบ เส้นปรุของสลิปที่เรียงกันจึงตรงแนวเดียวกัน (ยอดหลักหมื่นขึ้นไปค่อยขยาย)
 */
export function ChargeStub({ item, today }: { item: UpcomingItem; today: string }) {
  const days = daysBetween(today, item.date);
  const soon = days <= 3;
  const isTrial = item.kind === "trial_end";

  return (
    <Link
      href={`/subscriptions/${item.subscriptionId}/edit`}
      className="glass relative grid grid-cols-[minmax(0,1fr)_minmax(9.5rem,auto)] rounded-card hover:border-line-strong"
    >
      <span className="flex min-w-0 items-center gap-3 py-4 pr-3 pl-4">
        <ServiceLogo name={item.name} logoUrl={item.logoUrl} />
        <span className="min-w-0">
          <span className="line-clamp-2 block font-display text-lead leading-snug font-semibold break-words">
            {item.name}
          </span>
          <span className={`block text-caption ${isTrial ? "text-due" : "text-text-muted"}`}>
            {isTrial ? "หมดช่วงทดลองใช้ฟรี" : "ตัดเงิน"}
          </span>
        </span>
      </span>

      <span className="relative flex flex-col items-end justify-center border-l-[1.5px] border-dashed border-line-strong py-3 pr-4 pl-4 text-right">
        {/* รอยเว้าบน-ล่างของเส้นปรุ */}
        <span aria-hidden className="absolute -top-2 -left-2 size-4 rounded-full bg-night" />
        <span aria-hidden className="absolute -bottom-2 -left-2 size-4 rounded-full bg-night" />
        <span
          className={`text-caption whitespace-nowrap ${soon ? "font-semibold text-due" : "text-text-muted"}`}
        >
          {relativeDayLabel(today, item.date)}
        </span>
        <span className="figure text-lead leading-tight">{formatBaht(item.amount)}</span>
        <span className="text-caption whitespace-nowrap text-text-muted">{formatThaiDate(item.date)}</span>
      </span>
    </Link>
  );
}
