import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GroupManager } from "@/components/groups/group-manager";
import { ServiceLogo } from "@/components/service-logo";
import { getCurrentUser } from "@/server/auth";
import { ApiError } from "@/server/http";
import { currentPeriod, getGroup } from "@/server/services/groups";

export const metadata: Metadata = { title: "กลุ่มหาร" };

/** เลื่อนรอบเดือน "YYYY-MM" ไป ±n */
function shift(period: string, n: number) {
  const [y, m] = period.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** หน้ากลุ่มของเจ้าของ — ไม่ใช่เจ้าของหรือไม่มีอยู่ได้ 404 เหมือนกัน */
export default async function GroupPage({ params, searchParams }: PageProps<"/groups/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const rawId = (await params).id;
  if (!/^\d+$/.test(rawId)) notFound();
  const now = currentPeriod();
  const sp = (await searchParams).period;
  const period = typeof sp === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp) && sp <= now ? sp : now;

  let group;
  try {
    group = await getGroup(user.id, Number(rawId), period);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <main className="max-w-4xl">
      <Link href="/groups" className="text-caption text-text-muted hover:text-text">
        ← กลุ่มหารค่าบริการ
      </Link>
      <div className="mt-3 flex items-center gap-4">
        <ServiceLogo name={group.subscription.name} logoUrl={group.subscription.logoUrl} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-h2 font-bold">{group.name}</h1>
          <Link
            href={`/subscriptions/${group.subscription.id}/edit`}
            className="text-caption text-link underline underline-offset-4"
          >
            ดูรายการ {group.subscription.name}
          </Link>
        </div>
      </div>
      <GroupManager
        group={group}
        prevPeriod={shift(period, -1)}
        nextPeriod={period < now ? shift(period, 1) : null}
        isCurrent={period === now}
      />
    </main>
  );
}
