import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { ServiceLogo } from "@/components/service-logo";
import { formatBaht } from "@/lib/money";
import { listCategories, listServicesPublic } from "@/server/services/catalog";

export const metadata: Metadata = {
  title: "คลังบริการ",
  description: "ราคา subscription ในไทยเป็นเงินบาท พร้อมแพ็กเกจและวิธียกเลิกทีละขั้นตอน",
};

/** คลังบริการ (US-B1): ค้นหาชื่อ + แท็บหมวด ใช้ query string ล้วน จึงแชร์ลิงก์ผลค้นหาได้และไม่ต้องใช้ JS */
export default async function ServicesPage({ searchParams }: PageProps<"/services">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const [categories, services] = await Promise.all([
    listCategories(),
    listServicesPublic({ q: q || undefined, category: category || undefined }),
  ]);

  /** ลิงก์แท็บหมวดที่คงคำค้นเดิมไว้ */
  const tabHref = (slug: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (slug) params.set("category", slug);
    const s = params.toString();
    return s ? `/services?${s}` : "/services";
  };

  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-[1120px] px-4 pt-6 pb-16 md:px-8 md:pt-10">
        <h1 className="text-h2 font-bold md:text-h1">คลังบริการ</h1>
        <p className="mt-2 max-w-[40rem] text-text-muted">
          ราคาเป็นเงินบาทจากเว็บไซต์ของแต่ละบริการ พร้อมวิธียกเลิกทีละขั้นตอน
        </p>

        <form role="search" action="/services" className="mt-6 flex max-w-xl gap-2">
          {category && <input type="hidden" name="category" value={category} />}
          <label htmlFor="service-q" className="sr-only">
            ค้นหาบริการ
          </label>
          <input
            id="service-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="ค้นหา เช่น Netflix, Spotify"
            className="h-12 min-w-0 flex-1 rounded-control border border-line-strong bg-glass-strong px-4 placeholder:text-text-faint focus:border-paid focus:outline-none"
          />
          <button className="glass h-12 rounded-control border-line-strong px-5 font-display font-semibold">
            ค้นหา
          </button>
        </form>

        <nav aria-label="หมวด" className="-mx-4 mt-5 overflow-x-auto px-4">
          <ul className="flex gap-2">
            {[{ slug: "", name: "ทั้งหมด" }, ...categories].map((c) => {
              const active = c.slug === category;
              return (
                <li key={c.slug || "all"}>
                  <Link
                    href={tabHref(c.slug)}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center rounded-control border px-4 whitespace-nowrap ${
                      active
                        ? "border-paid bg-glass-strong font-semibold"
                        : "border-line text-text-muted hover:text-text"
                    }`}
                  >
                    {c.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {services.length === 0 ? (
          <div className="mt-10 max-w-md">
            <p className="text-lead font-semibold">ไม่พบบริการ{q && ` "${q}"`}</p>
            <p className="mt-1 text-text-muted">
              ลองค้นด้วยชื่อภาษาอังกฤษ หรือเพิ่มเป็นรายการของคุณเองได้จากหน้าเพิ่มรายการ
            </p>
            <Link
              href="/services"
              className="mt-3 inline-block font-medium text-link underline underline-offset-4"
            >
              ดูบริการทั้งหมด
            </Link>
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {services.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/services/${s.slug}`}
                  className="glass flex h-full flex-col gap-3 rounded-card p-4 hover:border-line-strong"
                >
                  <ServiceLogo name={s.name} logoUrl={s.logoUrl} />
                  <span className="font-display text-lead leading-snug font-semibold">{s.name}</span>
                  <span className="mt-auto text-caption text-text-muted">
                    {s.startingPrice === null ? (
                      s.category.name
                    ) : (
                      <>
                        เริ่ม{" "}
                        <span className="figure text-text">
                          {formatBaht(s.startingPrice, { short: true })}
                        </span>
                        /{s.startingCycle === "monthly" ? "เดือน" : "ปี"}
                      </>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
