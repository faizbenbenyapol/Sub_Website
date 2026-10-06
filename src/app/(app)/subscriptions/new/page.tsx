import type { Metadata } from "next";
import Link from "next/link";
import { SubscriptionForm } from "@/components/subscription-form";
import { todayInBangkok } from "@/lib/dates";
import { listCategories, listSelectableServices } from "@/server/services/catalog";

export const metadata: Metadata = { title: "เพิ่มรายการ" };

/** เพิ่มรายการ — ?service=slug มาจากปุ่ม "เพิ่มเข้ารายการของฉัน" ในหน้ารายละเอียดบริการ */
export default async function NewSubscriptionPage({ searchParams }: PageProps<"/subscriptions/new">) {
  const service = (await searchParams).service;
  const [services, categories] = await Promise.all([listSelectableServices(), listCategories()]);
  return (
    <main className="max-w-3xl">
      <Link href="/subscriptions" className="text-caption text-text-muted hover:text-text">
        ← รายการของฉัน
      </Link>
      <h1 className="mt-2 text-h2 font-bold">เพิ่มรายการ</h1>
      <div className="glass mt-6 rounded-card p-5 md:p-6">
        <SubscriptionForm
          services={services}
          categories={categories}
          today={todayInBangkok()}
          preselectSlug={typeof service === "string" ? service : undefined}
        />
      </div>
    </main>
  );
}
