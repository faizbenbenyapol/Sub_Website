import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanManager } from "@/components/admin/plan-manager";
import { ServiceDangerZone } from "@/components/admin/service-danger-zone";
import { ServiceForm } from "@/components/admin/service-form";
import { ServiceLogo } from "@/components/service-logo";
import { formatThaiDateTime } from "@/lib/dates";
import { formatBaht } from "@/lib/money";
import { ApiError } from "@/server/http";
import { getServiceAdmin, priceChangesOfService } from "@/server/services/admin-catalog";
import { listCategories } from "@/server/services/catalog";

export const metadata: Metadata = { title: "แก้บริการ · หลังบ้าน" };

/** โหลดบริการ — id ผิดรูปหรือไม่พบให้เป็นหน้า 404 */
async function load(rawId: string) {
  const id = Number(rawId);
  if (!/^\d+$/.test(rawId) || id <= 0) notFound();
  try {
    return await getServiceAdmin(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

/** หน้าแก้บริการ: ข้อมูลบริการ + แพ็กเกจ + ประวัติราคา + ลบ */
export default async function EditServicePage({ params }: PageProps<"/admin/services/[id]">) {
  const service = await load((await params).id);
  const [categories, changes] = await Promise.all([listCategories(), priceChangesOfService(service.id)]);

  return (
    <>
      <Link href="/admin/services" className="text-caption text-text-muted hover:text-text">
        ← บริการทั้งหมด
      </Link>
      <div className="mt-3 flex items-center gap-4">
        <ServiceLogo name={service.name} logoUrl={service.logoUrl} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-h2 font-bold">{service.name}</h1>
          <p className="text-text-muted">
            {service.isActive ? "แสดงในคลังบริการ" : "ซ่อนจากผู้ใช้อยู่"} · อัปเดตข้อมูล{" "}
            {formatThaiDateTime(service.updatedAt)}
          </p>
        </div>
      </div>

      <div className="glass mt-6 rounded-card p-5 md:p-6">
        <ServiceForm
          categories={categories}
          initial={{
            id: service.id,
            name: service.name,
            slug: service.slug,
            categoryId: service.category.id,
            logoUrl: service.logoUrl,
            websiteUrl: service.websiteUrl,
            cancelStepsText: service.cancelStepsText,
            isActive: service.isActive,
          }}
        />
      </div>

      <PlanManager serviceId={service.id} plans={service.plans} />

      <section aria-labelledby="history-heading" className="mt-10">
        <h2 id="history-heading" className="text-h3 font-bold">
          ประวัติการเปลี่ยนราคา
        </h2>
        {changes.length === 0 ? (
          <p className="mt-2 text-text-muted">
            ยังไม่เคยเปลี่ยนราคา — แก้ราคาในตารางแพ็กเกจแล้วจะบันทึกที่นี่
          </p>
        ) : (
          <ol className="glass mt-4 rounded-card">
            {changes.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line px-5 py-3 last:border-0"
              >
                <span className="font-medium">{c.planName}</span>
                <span className="figure">
                  <span className="text-text-muted line-through">{formatBaht(c.oldPrice)}</span>
                  <span aria-hidden> → </span>
                  <span className="sr-only"> เปลี่ยนเป็น </span>
                  {formatBaht(c.newPrice)}
                </span>
                <span className="w-full text-caption text-text-muted sm:w-auto">
                  {formatThaiDateTime(c.changedAt)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <ServiceDangerZone id={service.id} name={service.name} isActive={service.isActive} />
    </>
  );
}
