import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ServiceLogo } from "@/components/service-logo";
import {
  daysInMonth,
  formatThaiDate,
  formatThaiMonth,
  parseIsoDate,
  shiftMonth,
  toIsoDate,
  todayInBangkok,
} from "@/lib/dates";
import { formatBaht, formatCompactBaht } from "@/lib/money";
import { sumBilling, type UpcomingItem } from "@/lib/schedule";
import { getCurrentUser } from "@/server/auth";
import { getCalendar } from "@/server/services/dashboard";

export const metadata: Metadata = { title: "ปฏิทินวันตัดเงิน" };

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const MONTH_BUTTON =
  "flex size-11 items-center justify-center rounded-control border border-line text-text-muted hover:bg-glass-strong hover:text-text";

/**
 * ปฏิทินรายเดือน (US-D2): กริด 7 คอลัมน์เริ่มวันอาทิตย์ แต่ละวันแสดงโลโก้และยอดรวม
 * แผงข้าง (จอใหญ่อยู่ขวา มือถืออยู่ใต้ปฏิทิน): ปกติเป็นรายการทั้งเดือน กดวัน (?day=) แล้วเปลี่ยนเป็นสลิปของวันนั้น
 * — ลิงก์ล้วน ใช้คีย์บอร์ดได้และไม่ต้องใช้ JS
 */
export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const today = todayInBangkok();
  const thisMonth = today.slice(0, 7);
  const requested =
    typeof sp.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) ? sp.month : thisMonth;
  const month = requested < thisMonth ? thisMonth : requested; // เดือนที่ผ่านไปแล้วไม่มีข้อมูลฉายย้อนหลัง

  const { days } = await getCalendar(user.id, month, today);
  const byDate = new Map(days.map((d) => [d.date, d.items]));
  const [y, m] = month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const total = daysInMonth(y, m);
  const cells: (string | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: total }, (_, i) => toIsoDate(y, m, i + 1)),
  ];
  const selected = typeof sp.day === "string" && byDate.has(sp.day) ? sp.day : undefined;
  const monthTotal = sumBilling(days.flatMap((d) => d.items));
  const monthLabel = formatThaiMonth(month);
  /** ลิงก์ของเดือน (และวันที่เลือก) ในปฏิทิน */
  const href = (mo: string, day?: string) => `/calendar?month=${mo}${day ? `&day=${day}` : ""}`;

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h2 font-bold">{monthLabel}</h1>
        <nav aria-label="เลือกเดือน" className="flex items-center gap-1">
          {month > thisMonth ? (
            <Link href={href(shiftMonth(month, -1))} className={MONTH_BUTTON} aria-label="เดือนก่อนหน้า">
              <Chevron d="m14.5 6-6 6 6 6" />
            </Link>
          ) : (
            // เดือนที่ผ่านไปแล้วไม่มีข้อมูล — ปุ่มยังอยู่ที่เดิมแต่จางและกดไม่ได้
            <span aria-hidden className={`${MONTH_BUTTON} pointer-events-none opacity-35`}>
              <Chevron d="m14.5 6-6 6 6 6" />
            </span>
          )}
          {month !== thisMonth && (
            <Link
              href="/calendar"
              className="flex min-h-11 items-center rounded-control px-3 hover:bg-glass-strong"
            >
              เดือนนี้
            </Link>
          )}
          <Link href={href(shiftMonth(month, 1))} className={MONTH_BUTTON} aria-label="เดือนถัดไป">
            <Chevron d="m9.5 6 6 6-6 6" />
          </Link>
        </nav>
      </div>
      <p className="mt-1 text-text-muted">
        {monthTotal > 0 ? (
          <>
            ตั้งแต่วันนี้ถึงสิ้นเดือนจะตัดเงินรวม{" "}
            <span className="figure text-text">{formatBaht(monthTotal)}</span>
          </>
        ) : (
          "เดือนนี้ไม่มีรายการตัดเงิน"
        )}
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="glass rounded-card p-2 sm:p-3">
          <div className="grid grid-cols-7 text-center text-caption text-text-muted" aria-hidden>
            {WEEKDAYS.map((w) => (
              <span key={w} className="py-2">
                {w}
              </span>
            ))}
          </div>
          <ol className="grid grid-cols-7 gap-1">
            {cells.map((date, i) =>
              date ? (
                <DayCell
                  key={date}
                  date={date}
                  items={byDate.get(date) ?? []}
                  isToday={date === today}
                  isPast={date < today}
                  selected={date === selected}
                  href={href(month, date)}
                />
              ) : (
                <li key={`blank-${i}`} aria-hidden />
              ),
            )}
          </ol>
        </div>

        <section aria-live="polite" aria-labelledby="side-heading" className="lg:sticky lg:top-24">
          {selected ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="side-heading" className="text-lead font-bold">
                  {formatThaiDate(selected, "long")}
                </h2>
                <Link
                  scroll={false}
                  href={href(month)}
                  className="shrink-0 text-caption text-link underline underline-offset-4"
                >
                  ดูทั้งเดือน
                </Link>
              </div>
              <ul className="glass mt-3 divide-y divide-line overflow-hidden rounded-card">
                {byDate.get(selected)!.map((u) => (
                  <li key={`${u.subscriptionId}-${u.kind}`}>
                    <MonthRow item={u} href={`/subscriptions/${u.subscriptionId}/edit`} showDate={false} />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-caption text-text-muted">กดรายการเพื่อแก้ไขหรือดูรายละเอียด</p>
            </>
          ) : (
            <>
              <h2 id="side-heading" className="text-lead font-bold">
                รายการเดือนนี้
              </h2>
              {days.length === 0 ? (
                <p className="mt-2 text-text-muted">ไม่มีรายการตัดเงินในเดือนนี้</p>
              ) : (
                <ol className="glass mt-3 divide-y divide-line overflow-hidden rounded-card">
                  {days.flatMap((d) =>
                    d.items.map((u) => (
                      <li key={`${d.date}-${u.subscriptionId}-${u.kind}`}>
                        <MonthRow item={u} href={href(month, d.date)} />
                      </li>
                    )),
                  )}
                </ol>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

/** ไอคอนลูกศรของปุ่มเลื่อนเดือน (d = path ของ SVG) */
function Chevron({ d }: { d: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * แถวในแผงข้าง: วันที่ · โลโก้และชื่อ · ยอด
 * รายการทั้งเดือน: กดแล้วเลือกวันนั้นในปฏิทิน · รายการของวันที่เลือก (ไม่มีคอลัมน์วันที่): กดแล้วไปหน้าแก้ไข
 */
function MonthRow({ item, href, showDate = true }: { item: UpcomingItem; href: string; showDate?: boolean }) {
  const isTrial = item.kind === "trial_end";
  return (
    <Link
      scroll={showDate ? false : undefined}
      href={href}
      className={`grid items-center gap-3 px-4 py-3 hover:bg-glass-strong ${
        showDate ? "grid-cols-[5.25rem_minmax(0,1fr)_auto]" : "grid-cols-[minmax(0,1fr)_auto]"
      }`}
    >
      {showDate && (
        <span className="text-caption whitespace-nowrap text-text-muted">{formatThaiDate(item.date)}</span>
      )}
      <span className="flex min-w-0 items-center gap-2">
        <ServiceLogo name={item.name} logoUrl={item.logoUrl} size="xs" />
        <span className="min-w-0">
          <span className="line-clamp-2 block text-caption leading-snug font-medium break-words">
            {item.name}
          </span>
          {isTrial && <span className="block text-[11px] text-due">หมดช่วงทดลองใช้ฟรี</span>}
        </span>
      </span>
      <span className={`figure text-caption ${isTrial ? "text-text-muted" : "text-text"}`}>
        {formatBaht(item.amount, { short: true })}
      </span>
    </Link>
  );
}

/** ช่องวัน: desktop โลโก้ไม่เกิน 2 อัน + "+N" และยอดรวม, มือถือเหลือจุดกับยอด (docs/03 ข้อ 6) */
function DayCell({
  date,
  items,
  isToday,
  isPast,
  selected,
  href,
}: {
  date: string;
  items: UpcomingItem[];
  isToday: boolean;
  isPast: boolean;
  selected: boolean;
  href: string;
}) {
  const day = parseIsoDate(date).d;
  const sum = sumBilling(items);
  const frame = `flex min-h-16 flex-col rounded-control p-1.5 sm:min-h-24 sm:p-2 ${
    isToday ? "ring-2 ring-paid ring-inset" : ""
  } ${isPast ? "opacity-40" : ""}`;
  const dayNumber = (
    <span className="flex items-center justify-between gap-1">
      <span className={`figure text-caption ${isToday ? "font-semibold text-paid" : "text-text-muted"}`}>
        {day}
      </span>
      {isToday && <span className="hidden text-[11px] font-semibold text-paid sm:inline">วันนี้</span>}
    </span>
  );

  if (items.length === 0) {
    return <li className={frame}>{dayNumber}</li>;
  }
  const hasTrial = items.some((i) => i.kind === "trial_end");
  const label = `${formatThaiDate(date)}: ${items
    .map((i) => `${i.name}${i.kind === "trial_end" ? " หมดทดลองใช้" : ""}`)
    .join(", ")}${sum > 0 ? ` รวม ${formatBaht(sum)}` : ""}`;

  return (
    <li>
      <Link
        scroll={false}
        href={href}
        aria-label={label}
        aria-current={selected ? "date" : undefined}
        className={`${frame} border ${
          selected ? "border-paid bg-glass-strong" : "border-line hover:border-line-strong"
        }`}
      >
        {dayNumber}
        <span className="mt-1.5 hidden items-center gap-1 overflow-hidden sm:flex">
          {items.slice(0, 2).map((i) => (
            <ServiceLogo key={`${i.subscriptionId}-${i.kind}`} name={i.name} logoUrl={i.logoUrl} size="sm" />
          ))}
          {items.length > 2 && <span className="text-caption text-text-muted">+{items.length - 2}</span>}
        </span>
        <span
          aria-hidden
          className={`mt-1 size-2 rounded-full sm:hidden ${hasTrial ? "bg-due" : "bg-paid"}`}
        />
        {sum > 0 && (
          <span className="figure mt-auto text-[11px] leading-tight text-text sm:text-caption">
            {/* มือถือช่องกว้าง ~45px ใส่ "฿1,200" ไม่พอ จึงย่อเป็น "1.2k" · จอใหญ่แสดงยอดเต็ม */}
            <span className="sm:hidden">{formatCompactBaht(sum)}</span>
            <span className="hidden sm:inline">{formatBaht(sum, { short: true })}</span>
          </span>
        )}
      </Link>
    </li>
  );
}
