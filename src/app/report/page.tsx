/* eslint-disable @next/next/no-img-element -- โลโก้บริการมาจาก URL ที่ admin ใส่ได้ทุกโดเมน (เหมือน ServiceLogo) */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatThaiDate, formatThaiMonth, shiftMonth, todayInBangkok } from "@/lib/dates";
import { ringSegments, roundPercents } from "@/lib/donut";
import { formatBaht, fromSatang, toSatang } from "@/lib/money";
import { getCurrentUser } from "@/server/auth";
import { listCategories } from "@/server/services/catalog";
import { getMonthReport, type MonthCharge } from "@/server/services/dashboard";
import { getSavings } from "@/server/services/savings";
import type { SubscriptionDto } from "@/server/services/subscriptions";
import { PrintButton } from "./print-button";

// รายงานสรุปรายเดือน (แทน CSV เดิม): หน้า A4 พื้นขาวที่ออกแบบมาเพื่อพิมพ์ — กดบันทึกเป็น PDF จากหน้าต่างพิมพ์ของเบราว์เซอร์
// ไม่สร้าง PDF ฝั่งเซิร์ฟเวอร์ เพราะไลบรารี PDF ส่วนใหญ่วางสระ/วรรณยุกต์ไทยผิดตำแหน่ง ส่วนเบราว์เซอร์ใช้ฟอนต์เดียวกับเว็บได้ถูกต้อง

// สีหมวดชุดพื้นสว่าง (ลำดับเดียวกับวงกลมในหน้าภาพรวม) — ผ่าน validate_palette ของ dataviz บนพื้นขาว
// บางสีตัดกับพื้นขาวไม่ถึง 3:1 จึงมีชื่อหมวด + ยอด + % กำกับทุกชิ้นเสมอ
const CATEGORY_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];
const OVERFLOW_COLOR = "#9a9aa6";
const CYCLE = { monthly: "รายเดือน", yearly: "รายปี" } as const;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** เดือนจาก query (ไม่ให้ย้อนก่อนเดือนนี้ — ไม่มีประวัติการตัดเงินจริงให้สรุป) */
function pickMonth(raw: unknown, thisMonth: string) {
  const month = typeof raw === "string" && MONTH_RE.test(raw) ? raw : thisMonth;
  return month < thisMonth ? thisMonth : month;
}

/** ชื่อแท็บ = ชื่อไฟล์ตั้งต้นตอนบันทึก PDF ใน Chrome/Edge */
export async function generateMetadata({ searchParams }: PageProps<"/report">): Promise<Metadata> {
  const month = pickMonth((await searchParams).month, todayInBangkok().slice(0, 7));
  return { title: { absolute: `tadyang-summary-${month}` }, robots: { index: false } };
}

/** หน้ารายงานสรุปเดือน: โหลดข้อมูลเดือนที่เลือก คำนวณยอดต่าง ๆ แล้ววาดเป็นกระดาษ A4 */
export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const user = await getCurrentUser();
  if (!user || user.status !== "active") redirect("/login?next=/report");
  const sp = await searchParams;
  const today = todayInBangkok();
  const thisMonth = today.slice(0, 7);
  const month = pickMonth(sp.month, thisMonth);

  const [{ items, charges }, categories, savings] = await Promise.all([
    getMonthReport(user.id, month, today),
    listCategories(),
    getSavings(user.id),
  ]);

  /** รวมยอดเงินแบบสตางค์ (กันทศนิยมเพี้ยน) แล้วคืนเป็นบาท */
  const sum = (list: number[]) => fromSatang(list.reduce((s, v) => s + toSatang(v), 0));
  const monthTotal = sum(charges.map((c) => c.item.price));
  const paidTotal = sum(charges.filter((c) => c.paid).map((c) => c.item.price));
  const monthlyAverage = sum(items.map((i) => i.monthlyCost));
  const slices = categorySlices(
    charges,
    categories.map((c) => c.id),
  );
  const priciest = [...items].sort((a, b) => b.monthlyCost - a.monthlyCost)[0];
  // คำแนะนำของรายการเดียวกันเป็นทางเลือก (หารกลุ่ม หรือ เปลี่ยนแพ็กเกจ) ทำพร้อมกันไม่ได้
  // จึงเลือกทางที่ประหยัดสุดของแต่ละรายการ แสดง 3 อันดับแรก และยอดรวมคิดจากที่แสดงเท่านั้น
  const tips = [...savings]
    .sort((a, b) => b.saveYearly - a.saveYearly)
    .filter((s, i, all) => all.findIndex((x) => x.subscriptionId === s.subscriptionId) === i)
    .slice(0, 3);
  const savingYearly = sum(tips.map((s) => s.saveYearly));
  const monthLabel = formatThaiMonth(month);

  return (
    <div className="min-h-dvh px-4 py-6 md:py-10 print:p-0">
      {/* แถบเครื่องมือ: เห็นเฉพาะบนจอ */}
      <div className="mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/subscriptions"
          className="min-h-11 content-center text-link underline underline-offset-4"
        >
          ← กลับไปรายการของฉัน
        </Link>
        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto">
          <nav aria-label="เลือกเดือน" className="flex items-center gap-1">
            {month > thisMonth ? (
              <Link
                href={`/report?month=${shiftMonth(month, -1)}`}
                aria-label="เดือนก่อนหน้า"
                className={NAV_BTN}
              >
                ‹
              </Link>
            ) : (
              <span aria-hidden className={`${NAV_BTN} opacity-35`}>
                ‹
              </span>
            )}
            <span className="min-w-28 text-center font-display font-semibold">{monthLabel}</span>
            <Link href={`/report?month=${shiftMonth(month, 1)}`} aria-label="เดือนถัดไป" className={NAV_BTN}>
              ›
            </Link>
          </nav>
          <PrintButton />
        </div>
      </div>

      <article className="report-paper mx-auto max-w-[210mm] rounded-[20px] bg-white p-5 text-[#16161d] sm:p-[12mm] shadow-[0_24px_80px_rgb(0_0_0/0.5)] print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        {/* หัวรายงาน */}
        <header className="flex flex-col gap-3 border-b border-[#e7e7ee] pb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6 print:flex-row print:items-start print:justify-between">
          <div className="flex items-center gap-3">
            <img src="/icon.png" alt="" width={44} height={44} className="size-11 rounded-[12px]" />
            <div>
              <p className="font-display text-[20px] leading-tight font-bold">ตัดยัง?</p>
              <p className="text-[12px] text-[#5d5d6b]">สรุปค่า subscription รายเดือน</p>
            </div>
          </div>
          <div className="sm:text-right print:text-right">
            <h1 className="font-display text-[26px] leading-tight font-bold">{monthLabel}</h1>
            <p className="mt-1 text-[12px] text-[#5d5d6b]">
              ของคุณ {user.name} · จัดทำ {formatThaiDate(today, "medium")}
            </p>
          </div>
        </header>

        {/* ตัวเลขหลัก */}
        <section className="mt-6 grid grid-cols-1 gap-3 break-inside-avoid sm:grid-cols-[1.35fr_1fr_1fr] print:grid-cols-[1.35fr_1fr_1fr]">
          <div className="relative overflow-hidden rounded-[16px] bg-[#3b4cf5] p-5 text-white">
            <span aria-hidden className="absolute -top-8 -right-8 size-24 rounded-full bg-[#ff8a3d]" />
            <span aria-hidden className="absolute top-10 -right-2 size-12 rounded-full bg-[#c8f169]" />
            <p className="relative text-[12px] font-semibold text-white/85">เดือนนี้ตัดเงินรวม</p>
            <p className="figure relative mt-1 text-[30px] leading-tight font-semibold">
              {formatBaht(monthTotal)}
            </p>
            <p className="relative mt-1 text-[11px] text-white/85">
              {charges.length} ครั้ง
              {paidTotal > 0 && month === thisMonth && (
                <> · ตัดไปแล้ว {formatBaht(paidTotal, { short: true })}</>
              )}
            </p>
          </div>
          <Stat
            label="เฉลี่ยต่อเดือน"
            value={formatBaht(monthlyAverage, { short: true })}
            note={`ปีละ ${formatBaht(monthlyAverage * 12, { short: true })} · ${items.length} รายการ`}
          />
          {savingYearly > 0 ? (
            <Stat
              label="ประหยัดได้"
              value={`${formatBaht(savingYearly, { short: true })}/ปี`}
              note="ถ้าทำตามคำแนะนำด้านล่าง"
              accent
            />
          ) : (
            <Stat
              label="แพงสุด"
              value={priciest ? formatBaht(priciest.monthlyCost, { short: true }) : "–"}
              note={priciest ? `${priciest.name} ต่อเดือน` : "ยังไม่มีรายการ"}
            />
          )}
        </section>

        {/* สัดส่วนหมวดของเดือนนี้ */}
        {slices.length > 0 && (
          <section className="mt-7 break-inside-avoid">
            <SectionTitle title="แยกตามหมวด" note="ยอดที่ตัดเงินในเดือนนี้" />
            <div className="mt-3 flex flex-col items-center gap-5 rounded-[16px] border border-[#e7e7ee] p-5 sm:flex-row sm:gap-8 print:flex-row print:gap-8">
              <ReportDonut slices={slices} />
              <ul className="flex w-full flex-1 flex-col divide-y divide-[#efeff4]">
                {slices.map((s) => (
                  <li
                    key={s.key}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto_3rem] items-center gap-3 py-2 text-[12px]"
                  >
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span>{s.label}</span>
                    <span className="figure text-right">{formatBaht(s.value, { short: true })}</span>
                    <span className="figure text-right text-[#5d5d6b]">{s.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* วันตัดเงินในเดือนนี้ */}
        <section className="mt-7">
          <SectionTitle title="วันตัดเงินในเดือนนี้" note={`${charges.length} ครั้ง`} />
          {charges.length === 0 ? (
            <p className="mt-3 text-[13px] text-[#5d5d6b]">เดือนนี้ไม่มีรายการตัดเงิน</p>
          ) : (
            <table className="mt-3 w-full border-collapse text-[12px]">
              <thead>
                <tr className="text-left text-[11px] text-[#5d5d6b]">
                  <th className={TH}>วันที่</th>
                  <th className={TH}>บริการ</th>
                  <th className={`${TH} ${WIDE}`}>ช่องทางจ่าย</th>
                  <th className={`${TH} ${WIDE}`}>สถานะ</th>
                  <th className={`${TH} text-right`}>ยอด</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((c) => (
                  <ChargeRow key={`${c.date}-${c.item.id}`} charge={c} />
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={2} className={`pt-3 text-right ${NARROW}`}>
                    รวมทั้งเดือน
                  </td>
                  <td colSpan={4} className={`pt-3 text-right ${WIDE}`}>
                    รวมทั้งเดือน
                  </td>
                  <td className="figure pt-3 text-right text-[14px]">{formatBaht(monthTotal)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </section>

        {/* รายการที่ใช้งานอยู่ */}
        <section className="mt-7">
          <SectionTitle title="รายการที่ใช้งานอยู่" note={`${items.length} รายการ`} />
          <table className="mt-3 w-full border-collapse text-[12px]">
            <thead>
              <tr className="text-left text-[11px] text-[#5d5d6b]">
                <th className={TH}>บริการ</th>
                <th className={`${TH} ${WIDE}`}>หมวด</th>
                <th className={`${TH} ${WIDE}`}>รอบบิล</th>
                <th className={`${TH} text-right ${WIDE}`}>ราคา</th>
                <th className={`${TH} text-right whitespace-nowrap`}>เฉลี่ย/เดือน</th>
                <th className={`${TH} text-right whitespace-nowrap`}>ตัดครั้งถัดไป</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="break-inside-avoid border-b border-[#efeff4]">
                  <td className={TD}>
                    <ServiceCell item={i} />
                  </td>
                  <td className={`${TD} text-[#5d5d6b] ${WIDE}`}>{i.category.name}</td>
                  <td className={`${TD} text-[#5d5d6b] ${WIDE}`}>{CYCLE[i.billingCycle]}</td>
                  <td className={`${TD} figure text-right ${WIDE}`}>
                    {formatBaht(i.price, { short: true })}
                  </td>
                  <td className={`${TD} figure text-right`}>{formatBaht(i.monthlyCost, { short: true })}</td>
                  <td className={`${TD} text-right whitespace-nowrap`}>
                    {formatThaiDate(i.nextBillingDate)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className={`pt-3 text-right ${NARROW}`}>รวมเฉลี่ยต่อเดือน</td>
                <td colSpan={4} className={`pt-3 text-right ${WIDE}`}>
                  รวมเฉลี่ยต่อเดือน
                </td>
                <td className="figure pt-3 text-right text-[14px]">{formatBaht(monthlyAverage)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </section>

        {/* คำแนะนำประหยัด */}
        {tips.length > 0 && (
          <section className="mt-7 break-inside-avoid">
            <SectionTitle title="ประหยัดได้" note="คิดจากแพ็กเกจในรวมบริการของบริการเดียวกัน" />
            <ul className="mt-3 flex flex-col gap-2">
              {tips.map((s) => (
                <li
                  key={`${s.subscriptionId}-${s.kind}`}
                  className="flex flex-col gap-1 rounded-[12px] border-l-[3px] sm:flex-row sm:items-center sm:justify-between sm:gap-4 print:flex-row print:items-center print:justify-between border-[#ff8a3d] bg-[#fff6ef] px-4 py-2.5 text-[12px]"
                >
                  <span>{s.message}</span>
                  <span className="figure shrink-0 font-semibold">
                    {formatBaht(s.saveYearly, { short: true })}/ปี
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-8 flex flex-col gap-1 border-t sm:flex-row sm:justify-between print:flex-row print:justify-between border-[#e7e7ee] pt-3 text-[10px] text-[#8a8a96]">
          <span>ตัดยัง? — เตือนก่อนตัดเงิน รวมทุก subscription ไว้ที่เดียว</span>
          <span>ยอดเป็นบาท ตามราคาที่บันทึกไว้ · ยอดจริงอาจต่างตามโปรโมชันหรืออัตราแลกเปลี่ยน</span>
        </footer>
      </article>
    </div>
  );
}

const NAV_BTN =
  "flex size-11 items-center justify-center rounded-control border border-line text-lead text-text-muted hover:bg-glass-strong hover:text-text";
// คอลัมน์รองซ่อนบนจอแคบ (ดูบนมือถือ) แต่ PDF/จอกว้างแสดงครบ · NARROW = เซลล์ที่ใช้แทนเฉพาะจอแคบ
const WIDE = "hidden sm:table-cell print:table-cell";
const NARROW = "sm:hidden print:hidden";
const TH = "border-b border-[#d9d9e3] pb-2 font-medium";
const TD = "py-2.5 align-middle";

/** หัวข้อแต่ละส่วนในรายงาน พร้อมหมายเหตุเล็กชิดขวา */
function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-[16px] font-bold">{title}</h2>
      {note && <p className="text-[11px] text-[#5d5d6b]">{note}</p>}
    </div>
  );
}

/** การ์ดตัวเลขสรุปหนึ่งช่อง (accent = พื้นส้มอ่อน ใช้กับยอดที่ประหยัดได้) */
function Stat({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[16px] border p-5 ${accent ? "border-[#ff8a3d]/50 bg-[#fff6ef]" : "border-[#e7e7ee]"}`}
    >
      <p className="text-[12px] font-semibold text-[#5d5d6b]">{label}</p>
      <p className="figure mt-1 text-[22px] leading-tight font-semibold">{value}</p>
      <p className="mt-1 truncate text-[11px] text-[#5d5d6b]">{note}</p>
    </div>
  );
}

/** ช่องบริการในตาราง: โลโก้ (หรือตัวอักษรแรก) + ชื่อ + แพ็กเกจ */
function ServiceCell({ item }: { item: SubscriptionDto }) {
  return (
    <span className="flex items-center gap-2.5">
      {item.logoUrl ? (
        <img
          src={item.logoUrl}
          alt=""
          className="size-6 shrink-0 rounded-[6px] border border-[#e7e7ee] object-contain"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-[#efeff4] text-[11px] font-bold"
        >
          {Array.from(item.name.trim())[0]?.toUpperCase()}
        </span>
      )}
      <span className="min-w-0">
        <span className="block font-medium">{item.name}</span>
        {item.plan && <span className="block text-[11px] text-[#5d5d6b]">{item.plan.name}</span>}
      </span>
    </span>
  );
}

/** หนึ่งแถวในตารางวันตัดเงิน: วันที่ · บริการ · ช่องทางจ่าย · สถานะ · ยอด */
function ChargeRow({ charge }: { charge: MonthCharge }) {
  const { item, date, paid } = charge;
  return (
    <tr className="break-inside-avoid border-b border-[#efeff4]">
      <td className={`${TD} whitespace-nowrap`}>
        {formatThaiDate(date)}
        {/* จอแคบไม่มีคอลัมน์สถานะ จึงบอกใต้วันที่แทน */}
        <span className={`block text-[10px] text-[#5d5d6b] ${NARROW}`}>{paid ? "ตัดแล้ว" : "จะตัดเงิน"}</span>
      </td>
      <td className={TD}>
        <ServiceCell item={item} />
      </td>
      <td className={`${TD} text-[#5d5d6b] ${WIDE}`}>{item.paymentMethod ?? "–"}</td>
      <td className={`${TD} ${WIDE}`}>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            paid ? "bg-[#efeff4] text-[#5d5d6b]" : "bg-[#eef0ff] text-[#3b4cf5]"
          }`}
        >
          {paid ? "ตัดแล้ว" : "จะตัดเงิน"}
        </span>
      </td>
      <td className={`${TD} figure text-right font-medium`}>{formatBaht(item.price)}</td>
    </tr>
  );
}

type Slice = { key: number; label: string; value: number; color: string; pct: number };

/** ยอดตัดเงินของเดือนแยกหมวด เรียงตามลำดับหมวด สีติดหมวด (เกิน 6 หมวดรวมเป็นเทา) แล้วคิด % ให้รวม 100 */
function categorySlices(charges: MonthCharge[], categoryOrder: number[]): Slice[] {
  const position = new Map(categoryOrder.map((id, i) => [id, i]));
  const byCat = new Map<number, { label: string; satang: number }>();
  for (const c of charges) {
    const e = byCat.get(c.item.category.id) ?? { label: c.item.category.name, satang: 0 };
    e.satang += toSatang(c.item.price);
    byCat.set(c.item.category.id, e);
  }
  const ordered = [...byCat.entries()].sort(([a], [b]) => (position.get(a) ?? 99) - (position.get(b) ?? 99));
  const raw: Omit<Slice, "pct">[] = [];
  let overflow = 0;
  for (const [id, e] of ordered) {
    const i = position.get(id) ?? 99;
    if (i < CATEGORY_COLORS.length)
      raw.push({ key: id, label: e.label, value: fromSatang(e.satang), color: CATEGORY_COLORS[i] });
    else overflow += e.satang;
  }
  if (overflow > 0)
    raw.push({ key: -1, label: "หมวดอื่น", value: fromSatang(overflow), color: OVERFLOW_COLOR });
  const pct = roundPercents(raw.map((r) => r.value));
  return raw.map((r, i) => ({ ...r, pct: pct[i] }));
}

/** วงกลมสัดส่วนแบบพื้นขาว: วงบาง เว้นช่องขาว 2px ระหว่างชิ้น */
function ReportDonut({ slices }: { slices: Slice[] }) {
  const size = 132;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const { circumference: c, segments } = ringSegments(
    slices.map((s) => s.value),
    r,
  );
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="size-[33mm] shrink-0 -rotate-90"
      role="img"
      aria-label="สัดส่วนยอดตัดเงินแยกตามหมวด"
    >
      {slices.map((s, i) => (
        <circle
          key={s.key}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={stroke}
          strokeDasharray={`${segments[i].dash} ${c}`}
          strokeDashoffset={-segments[i].offset}
        />
      ))}
    </svg>
  );
}
