import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChargeStub } from "@/components/charge-stub";
import { ServiceLogo } from "@/components/service-logo";
import { daysInMonth, formatThaiDate, parseIsoDate, toIsoDate, todayInBangkok } from "@/lib/dates";
import { formatBaht } from "@/lib/money";
import { sumBilling, type UpcomingItem } from "@/lib/schedule";
import { getCurrentUser } from "@/server/auth";
import { getCalendar } from "@/server/services/dashboard";

export const metadata: Metadata = { title: "ปฏิทินวันตัดเงิน" };

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTH_FMT = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** เลื่อนเดือน "YYYY-MM" ไป ±n เดือน */
function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * ปฏิทินรายเดือน (US-D2): กริด 7 คอลัมน์เริ่มวันอาทิตย์ แต่ละวันแสดงโลโก้และยอดรวม
 * กดวัน (?day=) แล้วรายการของวันนั้นแสดงเป็นสลิปด้านล่าง — ลิงก์ล้วน ใช้คีย์บอร์ดได้และไม่ต้องใช้ JS
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
  const monthLabel = MONTH_FMT.format(new Date(Date.UTC(y, m - 1, 1)));
  const href = (mo: string, day?: string) => `/calendar?month=${mo}${day ? `&day=${day}` : ""}`;

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h2 font-bold">{monthLabel}</h1>
        <nav aria-label="เลือกเดือน" className="flex items-center gap-1">
          {month > thisMonth ? (
            <Link
              href={href(shiftMonth(month, -1))}
              className="flex size-11 items-center justify-center rounded-control border border-line hover:bg-glass-strong"
              aria-label="เดือนก่อนหน้า"
            >
              ‹
            </Link>
          ) : (
            <span
              aria-hidden
              className="flex size-11 items-center justify-center rounded-control text-text-faint"
            >
              ‹
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
          <Link
            href={href(shiftMonth(month, 1))}
            className="flex size-11 items-center justify-center rounded-control border border-line hover:bg-glass-strong"
            aria-label="เดือนถัดไป"
          >
            ›
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

      <div className="glass mt-5 rounded-card p-2 sm:p-3">
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

      <section aria-live="polite" className="mt-6">
        {selected ? (
          <>
            <h2 className="text-h3 font-bold">{formatThaiDate(selected, "long")}</h2>
            <ul className="mt-3 flex max-w-xl flex-col gap-3">
              {byDate.get(selected)!.map((u) => (
                <li key={`${u.subscriptionId}-${u.kind}`}>
                  <ChargeStub item={u} today={today} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          days.length > 0 && <p className="text-text-muted">กดวันที่มีรายการเพื่อดูรายละเอียด</p>
        )}
      </section>
    </main>
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
    isToday ? "ring-2 ring-paid" : ""
  } ${selected ? "bg-glass-strong" : ""}`;
  const dayNumber = (
    <span className={`figure text-caption ${isPast ? "text-text-faint" : "text-text-muted"}`}>{day}</span>
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
        className={`${frame} border border-line hover:border-line-strong`}
      >
        {dayNumber}
        <span className="mt-1 hidden gap-1 sm:flex">
          {items.slice(0, 2).map((i) => (
            <ServiceLogo key={`${i.subscriptionId}-${i.kind}`} name={i.name} logoUrl={i.logoUrl} size="xs" />
          ))}
          {items.length > 2 && <span className="text-caption text-text-muted">+{items.length - 2}</span>}
        </span>
        <span
          aria-hidden
          className={`mt-1 size-2 rounded-full sm:hidden ${hasTrial ? "bg-due" : "bg-paid"}`}
        />
        {sum > 0 && (
          <span className="figure mt-auto truncate text-[11px] leading-tight text-text sm:text-caption">
            {formatBaht(sum, { short: true })}
          </span>
        )}
      </Link>
    </li>
  );
}
