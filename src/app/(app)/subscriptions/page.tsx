import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ServiceLogo } from "@/components/service-logo";
import { daysBetween, formatThaiDate, relativeDayLabel, todayInBangkok } from "@/lib/dates";
import { formatBaht } from "@/lib/money";
import { getCurrentUser } from "@/server/auth";
import { listSubscriptions, type SubscriptionDto } from "@/server/services/subscriptions";

export const metadata: Metadata = { title: "รายการของฉัน" };

const TABS = [
  { status: "active", label: "ใช้งานอยู่" },
  { status: "cancelled", label: "ยกเลิกแล้ว" },
] as const;

/** รายการของฉัน (US-C2): แท็บใช้งานอยู่/ยกเลิกแล้ว เป็นรายการมีเส้นคั่น กดแถวเพื่อแก้ไข */
export default async function SubscriptionsPage({ searchParams }: PageProps<"/subscriptions">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const status = (await searchParams).status === "cancelled" ? "cancelled" : "active";
  const items = await listSubscriptions(user.id, status);
  const today = todayInBangkok();

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-h2 font-bold">รายการของฉัน</h1>
        <div className="flex flex-wrap gap-x-5">
          <Link
            href="/groups"
            className="min-h-11 content-center font-medium text-link underline underline-offset-4"
          >
            หารค่าบริการกับเพื่อน
          </Link>
          {/* ลิงก์ธรรมดา: route ตอบเป็นไฟล์แนบ เบราว์เซอร์ดาวน์โหลดเอง (รวมแท็บยกเลิกแล้วด้วย) */}
          <a
            href="/api/subscriptions/export"
            download
            className="min-h-11 content-center font-medium text-link underline underline-offset-4"
          >
            ดาวน์โหลด CSV
          </a>
        </div>
      </div>

      <nav aria-label="สถานะรายการ" className="mt-5">
        <ul className="flex gap-2">
          {TABS.map((t) => (
            <li key={t.status}>
              <Link
                href={t.status === "active" ? "/subscriptions" : "/subscriptions?status=cancelled"}
                aria-current={t.status === status ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-control border px-4 ${
                  t.status === status
                    ? "border-paid bg-glass-strong font-semibold"
                    : "border-line text-text-muted hover:text-text"
                }`}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {items.length === 0 ? (
        <EmptyState status={status} />
      ) : (
        <ul className="glass mt-5 rounded-card">
          {items.map((s) => (
            <li key={s.id} className="border-b border-line last:border-0">
              <Row item={s} today={today} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/** หนึ่งแถว: โลโก้ · ชื่อ+แพ็กเกจ · วันตัดเงิน · ราคา (ชิดขวา mono) — มือถือยุบเป็นสองบรรทัด */
function Row({ item: s, today }: { item: SubscriptionDto; today: string }) {
  const days = daysBetween(today, s.nextBillingDate);
  const soon = s.status === "active" && days <= 3;
  const onTrial = s.trialEndsAt !== null && s.trialEndsAt >= today;
  const catalogChanged = s.catalogPrice !== null && s.catalogPrice !== s.price;

  return (
    <Link
      href={`/subscriptions/${s.id}/edit`}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-4 hover:bg-glass md:px-5"
    >
      <ServiceLogo name={s.name} logoUrl={s.logoUrl} />
      <div className="min-w-0">
        <p className="truncate font-display text-lead font-semibold" title={s.name}>
          {s.name}
          {s.plan && (
            <span className="font-sans text-body font-normal text-text-muted"> · {s.plan.name}</span>
          )}
        </p>
        <p className="flex flex-wrap gap-x-3 text-caption text-text-muted">
          {s.status === "active" ? (
            <span className={`whitespace-nowrap ${soon ? "font-semibold text-due" : ""}`}>
              {formatThaiDate(s.nextBillingDate)} · {relativeDayLabel(today, s.nextBillingDate)}
            </span>
          ) : (
            <span>ยกเลิกแล้ว</span>
          )}
          {onTrial && (
            <span className="whitespace-nowrap text-due">ทดลองใช้ถึง {formatThaiDate(s.trialEndsAt!)}</span>
          )}
          {s.paymentMethod && <span>{s.paymentMethod}</span>}
          {catalogChanged && <span>ราคาในคลังตอนนี้ {formatBaht(s.catalogPrice!, { short: true })}</span>}
        </p>
      </div>
      <p className="text-right">
        <span className="figure block text-lead">{formatBaht(s.price)}</span>
        <span className="text-caption text-text-muted">
          {s.billingCycle === "monthly" ? "ต่อเดือน" : "ต่อปี"}
        </span>
      </p>
    </Link>
  );
}

/** ไม่มีรายการ: บอกว่าทำอะไรต่อได้ + ปุ่มทำเลย */
function EmptyState({ status }: { status: "active" | "cancelled" }) {
  if (status === "cancelled") {
    return (
      <p className="mt-8 text-text-muted">ยังไม่มีรายการที่ยกเลิก — รายการที่กดยกเลิกจะย้ายมาอยู่ที่นี่</p>
    );
  }
  return (
    <div className="mt-8 max-w-md">
      <p className="text-lead font-semibold">ยังไม่มีรายการ</p>
      <p className="mt-1 text-text-muted">เริ่มจากบริการที่จ่ายอยู่ทุกเดือน เช่น Netflix หรือ Spotify</p>
      <Link
        href="/subscriptions/new"
        className="mt-4 inline-flex h-12 items-center rounded-control bg-paid px-6 font-display font-semibold text-night"
      >
        เพิ่มรายการแรก
      </Link>
    </div>
  );
}
