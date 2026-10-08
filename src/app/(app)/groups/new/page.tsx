import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GroupCreateForm } from "@/components/groups/group-create-form";
import { getCurrentUser } from "@/server/auth";
import { plansByService } from "@/server/services/catalog";
import { lastPromptpayId } from "@/server/services/groups";
import { listSubscriptions } from "@/server/services/subscriptions";

export const metadata: Metadata = { title: "สร้างกลุ่มหาร" };

/** สร้างกลุ่มหาร — ?subscription=id มาจากหน้าแก้รายการ */
export default async function NewGroupPage({ searchParams }: PageProps<"/groups/new">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [subs, lastId] = await Promise.all([listSubscriptions(user.id, "active"), lastPromptpayId(user.id)]);
  const candidates = subs.filter((s) => s.billingCycle === "monthly" && s.groupId === null);
  const planMap = await plansByService(candidates.flatMap((s) => (s.service ? [s.service.id] : [])));
  const options = candidates
    .map((s) => ({
      id: s.id,
      name: s.plan ? `${s.name} ${s.plan.name}` : s.name,
      price: s.price,
      maxMembers: s.plan
        ? (planMap.get(s.service!.id)?.find((p) => p.id === s.plan!.id)?.maxMembers ?? null)
        : null,
    }))
    .sort((a, b) => (b.maxMembers ?? 1) - (a.maxMembers ?? 1)); // Family plan ขึ้นก่อน
  const pre = Number((await searchParams).subscription);

  return (
    <main className="max-w-3xl">
      <Link href="/groups" className="text-caption text-text-muted hover:text-text">
        ← กลุ่มหารค่าบริการ
      </Link>
      <h1 className="mt-2 text-h2 font-bold">สร้างกลุ่มหาร</h1>
      <p className="mt-1 text-text-muted">เพื่อนแต่ละคนจะได้ลิงก์ที่มี QR พร้อมเพย์ใส่ยอดของตัวเองไว้แล้ว</p>
      {options.length === 0 ? (
        <div className="mt-6 max-w-md">
          <p className="text-text-muted">
            ยังไม่มีรายการที่หารได้ — หารได้เฉพาะรายการรายเดือนที่ใช้งานอยู่และยังไม่มีกลุ่ม
          </p>
          <Link
            href="/subscriptions/new"
            className="mt-3 inline-block font-medium text-link underline underline-offset-4"
          >
            เพิ่มรายการ
          </Link>
        </div>
      ) : (
        <div className="glass mt-6 rounded-card p-5 md:p-6">
          <GroupCreateForm
            subscriptions={options}
            defaultSubscriptionId={options.some((o) => o.id === pre) ? pre : undefined}
            defaultPromptpayId={lastId ?? undefined}
          />
        </div>
      )}
    </main>
  );
}
