import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BarList } from "@/components/charts/bar-list";
import { ChargeStub } from "@/components/charge-stub";
import { todayInBangkok } from "@/lib/dates";
import { formatBaht } from "@/lib/money";
import { sumBilling } from "@/lib/schedule";
import { getCurrentUser } from "@/server/auth";
import { getDashboard, UPCOMING_DAYS } from "@/server/services/dashboard";
import { getSavings } from "@/server/services/savings";

export const metadata: Metadata = { title: "ภาพรวม" };

const QUICK_ADD = [
  { slug: "netflix", name: "Netflix" },
  { slug: "spotify", name: "Spotify" },
  { slug: "youtube-premium", name: "YouTube Premium" },
  { slug: "icloud-plus", name: "iCloud+" },
];

/**
 * Dashboard ผู้ใช้ (US-D1) — ตัวเลขที่ตอบคำถามหลักมีตัวเดียว: ยอดต่อเดือน (บล็อก slip ทึบ บล็อกเดียวของหน้า)
 * ตามด้วยสลิปรายการที่จะตัดเงินใน 7 วัน และแท่งสัดส่วนตามหมวด (docs/03 ข้อ 6)
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const today = todayInBangkok();
  const [{ totals, byCategory, upcoming }, savings] = await Promise.all([
    getDashboard(user.id, today),
    getSavings(user.id),
  ]);

  if (totals.activeCount === 0) return <EmptyDashboard name={user.name} />;
  const upcomingTotal = sumBilling(upcoming);

  return (
    <main>
      <h1 className="sr-only">ภาพรวมค่าใช้จ่าย</h1>
      <p className="text-text-muted">สวัสดี {user.name}</p>

      <div className="mt-3 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10">
        <div className="flex flex-col gap-8">
          <section
            aria-label="ค่าใช้จ่ายต่อเดือน"
            className="relative overflow-hidden rounded-hero bg-slip p-6 md:p-8"
          >
            <span aria-hidden className="absolute -top-12 -right-12 size-40 rounded-full bg-due" />
            <span aria-hidden className="absolute top-20 -right-3 size-20 rounded-full bg-paid" />
            <p className="relative font-display text-lead font-semibold">เดือนนี้จ่าย</p>
            <p className="figure relative mt-1 text-[40px] leading-tight font-semibold sm:text-figure">
              {formatBaht(totals.monthly)}
            </p>
            <p className="relative mt-2 text-white/85">
              ปีละ {formatBaht(totals.yearly, { short: true })} · {totals.activeCount} รายการ
            </p>
          </section>

          <section aria-labelledby="category-heading">
            <h2 id="category-heading" className="text-h3 font-bold">
              แยกตามหมวด
            </h2>
            <p className="mt-1 text-caption text-text-muted">ต่อเดือน (รายปีหาร 12 แล้ว)</p>
            <div className="mt-4">
              <BarList
                label="ค่าใช้จ่ายต่อเดือนแยกตามหมวด"
                data={byCategory.map((c) => ({ label: c.name, value: c.monthly }))}
              />
            </div>
          </section>

          {savings.length > 0 && (
            <section aria-labelledby="savings-heading">
              <h2 id="savings-heading" className="text-h3 font-bold">
                ประหยัดได้
              </h2>
              <p className="mt-1 text-caption text-text-muted">คิดจากแพ็กเกจในคลังของบริการเดียวกัน</p>
              <ul className="mt-4 flex flex-col gap-3">
                {savings.slice(0, 3).map((s) => (
                  <li
                    key={`${s.subscriptionId}-${s.kind}`}
                    className="glass rounded-control border-l-[3px] border-l-due p-4"
                  >
                    <p>{s.message}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 text-caption text-text-muted">
                      <span>
                        ประหยัด{" "}
                        <span className="figure text-text">{formatBaht(s.saveYearly, { short: true })}</span>
                        /ปี
                      </span>
                      <Link
                        href={
                          s.onSuggestedPlan
                            ? `/groups/new?subscription=${s.subscriptionId}`
                            : `/subscriptions/${s.subscriptionId}/edit`
                        }
                        className="min-h-11 content-center font-medium text-link underline underline-offset-4"
                      >
                        {s.onSuggestedPlan ? "สร้างกลุ่มหาร" : "เปลี่ยนแพ็กเกจ"}
                      </Link>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <section aria-labelledby="upcoming-heading">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="upcoming-heading" className="text-h3 font-bold">
              จะตัดเงินใน {UPCOMING_DAYS} วัน
            </h2>
            {upcomingTotal > 0 && (
              <p className="text-caption text-text-muted">
                รวม <span className="figure text-text">{formatBaht(upcomingTotal)}</span>
              </p>
            )}
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-4 text-text-muted">7 วันนี้ไม่มีรายการตัดเงิน ดูวันถัดไปได้ในปฏิทิน</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {upcoming.map((u) => (
                <li key={`${u.subscriptionId}-${u.kind}-${u.date}`}>
                  <ChargeStub item={u} today={today} />
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/calendar"
            className="mt-4 inline-block font-medium text-link underline underline-offset-4"
          >
            ดูปฏิทินทั้งเดือน
          </Link>
        </section>
      </div>
    </main>
  );
}

/** ยังไม่มีรายการ: บล็อก slip กลายเป็นคำเชิญ + ทางลัดบริการยอดนิยม (docs/03 ข้อ 6) */
function EmptyDashboard({ name }: { name: string }) {
  return (
    <main className="max-w-xl">
      <p className="text-text-muted">สวัสดี {name}</p>
      <section className="relative mt-3 overflow-hidden rounded-hero bg-slip p-6 md:p-8">
        <span aria-hidden className="absolute -top-12 -right-12 size-40 rounded-full bg-due" />
        <h1 className="relative max-w-[13rem] text-h2 font-bold sm:max-w-none">ยังไม่มีรายการ</h1>
        <p className="relative mt-2 max-w-[13rem] text-white/85 sm:max-w-sm">
          เริ่มจากบริการที่จ่ายอยู่ทุกเดือน แล้วระบบจะเตือนทางอีเมลก่อนตัดเงิน
        </p>
        <Link
          href="/subscriptions/new"
          className="relative mt-5 inline-flex h-12 items-center rounded-control bg-paid px-6 font-display font-semibold text-night"
        >
          เพิ่มรายการแรก
        </Link>
      </section>
      <h2 className="mt-8 text-lead font-semibold">หรือเลือกจากบริการยอดนิยม</h2>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {QUICK_ADD.map((s) => (
          <li key={s.slug}>
            <Link
              href={`/subscriptions/new?service=${s.slug}`}
              className="glass flex min-h-12 items-center rounded-control px-4 font-medium hover:border-line-strong"
            >
              {s.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
