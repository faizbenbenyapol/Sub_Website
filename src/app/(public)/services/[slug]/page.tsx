import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/public-header";
import { ServiceLogo } from "@/components/service-logo";
import { formatThaiDate, todayInBangkok } from "@/lib/dates";
import { formatBaht } from "@/lib/money";
import { getCurrentUser } from "@/server/auth";
import { getServiceBySlug } from "@/server/services/catalog";

/** ชื่อหน้าเป็นชื่อบริการ */
export async function generateMetadata({ params }: PageProps<"/services/[slug]">): Promise<Metadata> {
  const service = await getServiceBySlug((await params).slug);
  return service
    ? {
        title: `${service.name} ราคาและวิธียกเลิก`,
        description: `แพ็กเกจและราคา ${service.name} เป็นเงินบาท พร้อมวิธียกเลิก`,
      }
    : { title: "ไม่พบบริการ" };
}

const CYCLE = { monthly: "รายเดือน", yearly: "รายปี" } as const;

/** รายละเอียดบริการ (US-B2): แพ็กเกจ, วันที่อัปเดต, วิธียกเลิก (#cancel ให้ลิงก์จากอีเมลกระโดดมาได้) */
export default async function ServiceDetailPage({ params }: PageProps<"/services/[slug]">) {
  const { slug } = await params;
  const [service, user] = await Promise.all([getServiceBySlug(slug), getCurrentUser()]);
  if (!service) notFound();
  const signedIn = user?.status === "active";
  const addHref = `/subscriptions/new?service=${service.slug}`;
  const updated = formatThaiDate(todayInBangkok(new Date(service.updatedAt)), "medium");

  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-[1120px] px-4 pt-6 pb-28 md:px-8 md:pt-10 lg:pb-16">
        <Link href="/services" className="text-caption text-text-muted hover:text-text">
          ← รวมบริการ
        </Link>

        <div className="mt-4 flex items-center gap-4">
          <ServiceLogo name={service.name} logoUrl={service.logoUrl} size="lg" />
          <div className="min-w-0">
            <h1 className="text-h2 font-bold md:text-h1">{service.name}</h1>
            <p className="text-text-muted">
              {service.category.name} · อัปเดตข้อมูล {updated}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={signedIn ? addHref : `/login?next=${encodeURIComponent(addHref)}`}
            className="inline-flex h-12 items-center rounded-control bg-paid px-6 font-display font-semibold text-night"
          >
            {signedIn ? "เพิ่มเข้ารายการของฉัน" : "เข้าสู่ระบบเพื่อเพิ่ม"}
          </Link>
          {service.websiteUrl && (
            <a
              href={service.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="glass inline-flex h-12 items-center rounded-control border-line-strong px-6 font-display font-semibold"
            >
              เว็บไซต์ {service.name}
              <span className="sr-only"> (เปิดในแท็บใหม่)</span>
            </a>
          )}
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section aria-labelledby="plans-heading">
            <h2 id="plans-heading" className="text-h3 font-bold">
              แพ็กเกจและราคา
            </h2>
            {service.plans.length === 0 ? (
              <p className="mt-3 text-text-muted">ยังไม่มีข้อมูลแพ็กเกจ</p>
            ) : (
              <table className="glass mt-4 w-full rounded-card text-left">
                <thead className="text-caption text-text-muted">
                  <tr className="border-b border-line">
                    <th scope="col" className="px-4 py-3 font-medium">
                      แพ็กเกจ
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      ราคา
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      ใช้ได้
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {service.plans.map((p) => (
                    <tr key={p.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="figure">{formatBaht(p.price)}</span>
                        <span className="block text-caption text-text-muted">{CYCLE[p.billingCycle]}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="figure">{p.maxMembers}</span>
                        <span className="text-caption text-text-muted"> คน</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section aria-labelledby="cancel-heading" id="cancel" className="scroll-mt-20">
            <h2 id="cancel-heading" className="text-h3 font-bold">
              วิธียกเลิก
            </h2>
            <ol className="mt-4 flex flex-col gap-4">
              {service.cancelSteps.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span aria-hidden className="figure w-8 shrink-0 text-h3 leading-none text-due">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>
    </>
  );
}
