import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ServiceLogo } from "@/components/service-logo";
import { formatThaiMonth } from "@/lib/dates";
import { formatBaht } from "@/lib/money";
import { getCurrentUser } from "@/server/auth";
import { currentPeriod, listGroups } from "@/server/services/groups";

export const metadata: Metadata = { title: "หารค่าบริการ" };

/** กลุ่มหารทั้งหมด: ใครจ่ายเดือนนี้แล้วกี่คน (US-F3) */
export default async function GroupsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const groups = await listGroups(user.id);

  return (
    <main className="max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h2 font-bold">หารค่าบริการ</h1>
          <p className="mt-1 text-text-muted">สถานะการจ่ายเดือน{formatThaiMonth(currentPeriod())}</p>
        </div>
        {groups.length > 0 && (
          <Link
            href="/groups/new"
            className="glass inline-flex h-12 items-center rounded-control border-line-strong px-5 font-display font-semibold"
          >
            สร้างกลุ่มหาร
          </Link>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="mt-8 max-w-md">
          <p className="text-lead font-semibold">ยังไม่ได้หารกับใคร</p>
          <p className="mt-1 text-text-muted">
            เลือกรายการที่เป็น Family plan เช่น Spotify Family หรือ YouTube ครอบครัว แล้วให้เพื่อนสแกน QR
            จ่ายส่วนของตัวเอง
          </p>
          <Link
            href="/groups/new"
            className="mt-4 inline-flex h-12 items-center rounded-control bg-paid px-6 font-display font-semibold text-night"
          >
            สร้างกลุ่มหาร
          </Link>
        </div>
      ) : (
        <ul className="glass mt-6 rounded-card">
          {groups.map((g) => {
            const done = g.memberCount > 0 && g.paidCount === g.memberCount;
            return (
              <li key={g.id} className="border-b border-line last:border-0">
                <Link
                  href={`/groups/${g.id}`}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 hover:bg-glass md:px-5"
                >
                  <ServiceLogo name={g.subscription.name} logoUrl={g.subscription.logoUrl} />
                  <span className="min-w-0">
                    <span className="block truncate font-display text-lead font-semibold">{g.name}</span>
                    <span className="text-caption text-text-muted">
                      {formatBaht(g.total)}/เดือน · สมาชิก {g.memberCount} คน
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="figure block text-lead">
                      {g.paidCount}/{g.memberCount}
                    </span>
                    <span className={`text-caption ${done ? "text-paid" : "text-text-muted"}`}>
                      {done ? "จ่ายครบแล้ว" : "จ่ายแล้ว"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
