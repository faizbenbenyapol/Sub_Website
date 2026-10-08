import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SubscriptionForm } from "@/components/subscription-form";
import { SubscriptionStatusActions } from "@/components/subscription-status-actions";
import { todayInBangkok } from "@/lib/dates";
import { getCurrentUser } from "@/server/auth";
import { ApiError } from "@/server/http";
import { listCategories, listSelectableServices } from "@/server/services/catalog";
import { getSubscription } from "@/server/services/subscriptions";

export const metadata: Metadata = { title: "แก้รายการ" };

/** โหลดรายการของผู้ใช้คนนี้ — ไม่ใช่ของตัวเองหรือไม่มีอยู่ได้หน้า 404 เหมือนกัน */
async function load(userId: number, rawId: string) {
  if (!/^\d+$/.test(rawId)) notFound();
  try {
    return await getSubscription(userId, Number(rawId));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

/** แก้รายการ + ยกเลิก/กลับมาใช้/ลบ */
export default async function EditSubscriptionPage({ params }: PageProps<"/subscriptions/[id]/edit">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const item = await load(user.id, (await params).id);
  const [services, categories] = await Promise.all([listSelectableServices(), listCategories()]);
  const today = todayInBangkok();

  return (
    <main className="max-w-3xl">
      <Link
        href={item.status === "active" ? "/subscriptions" : "/subscriptions?status=cancelled"}
        className="text-caption text-text-muted hover:text-text"
      >
        ← รายการของฉัน
      </Link>
      <h1 className="mt-2 truncate text-h2 font-bold">แก้ {item.name}</h1>
      <p className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
        {item.service && (
          <Link
            href={`/services/${item.service.slug}#cancel`}
            className="text-link underline underline-offset-4"
          >
            ดูวิธียกเลิก {item.name}
          </Link>
        )}
        {item.groupId !== null ? (
          <Link href={`/groups/${item.groupId}`} className="text-link underline underline-offset-4">
            ดูกลุ่มหารค่า {item.name}
          </Link>
        ) : (
          item.status === "active" &&
          item.billingCycle === "monthly" && (
            <Link
              href={`/groups/new?subscription=${item.id}`}
              className="text-link underline underline-offset-4"
            >
              หารค่า {item.name} กับเพื่อน
            </Link>
          )
        )}
      </p>
      <div className="glass mt-6 rounded-card p-5 md:p-6">
        <SubscriptionForm services={services} categories={categories} today={today} initial={item} />
      </div>
      <SubscriptionStatusActions
        id={item.id}
        name={item.name}
        status={item.status}
        hasGroup={item.groupId !== null}
        today={today}
      />
    </main>
  );
}
