import type { Metadata } from "next";
import Link from "next/link";
import { ServiceLogo } from "@/components/service-logo";
import { formatBaht } from "@/lib/money";
import { listCategoriesAdmin, listServicesAdmin } from "@/server/services/admin-catalog";

export const metadata: Metadata = { title: "บริการ · หลังบ้าน" };

/** รายการบริการทั้งหมดรวมที่ซ่อน — ค้นหา/กรองด้วย query string (ฟอร์ม GET ไม่ต้องใช้ JS) */
export default async function AdminServicesPage({ searchParams }: PageProps<"/admin/services">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const [services, categories] = await Promise.all([
    listServicesAdmin({ q, category: category || undefined }),
    listCategoriesAdmin(),
  ]);
  const filtered = q !== "" || category !== "";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h2 font-bold">บริการและแพ็กเกจ</h1>
          <p className="mt-1 text-text-muted">คลังข้อมูลที่ผู้ใช้เห็นในหน้าคลังบริการ</p>
        </div>
        <Link
          href="/admin/services/new"
          className="inline-flex h-12 items-center rounded-control bg-paid px-6 font-display font-semibold text-night"
        >
          เพิ่มบริการ
        </Link>
      </div>

      <form role="search" className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="q" className="text-caption font-medium">
            ค้นหาชื่อหรือ slug
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="เช่น netflix"
            className="h-12 rounded-control border border-line-strong bg-glass-strong px-4 placeholder:text-text-faint focus:border-paid focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="category" className="text-caption font-medium">
            หมวด
          </label>
          <select
            id="category"
            name="category"
            defaultValue={category}
            className="h-12 rounded-control border border-line-strong bg-glass-strong px-4 focus:border-paid focus:outline-none"
          >
            <option value="">ทุกหมวด</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button className="glass h-12 rounded-control border-line-strong px-6 font-display font-semibold">
          ค้นหา
        </button>
      </form>

      <div className="glass relative mt-6 overflow-x-auto rounded-card">
        <table className="w-full min-w-[640px] text-left">
          <thead className="text-caption text-text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="px-5 py-3 font-medium">
                บริการ
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                หมวด
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
                เริ่มต้น
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
                แพ็กเกจ
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
                ผู้ใช้ที่ผูก
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                สถานะ
              </th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0 hover:bg-glass">
                <td className="px-5 py-3">
                  <Link
                    href={`/admin/services/${s.id}`}
                    className="flex items-center gap-3 font-medium hover:underline"
                  >
                    <ServiceLogo name={s.name} logoUrl={s.logoUrl} size="sm" />
                    {s.name}
                  </Link>
                </td>
                <td className="px-5 py-3 text-text-muted">{s.category.name}</td>
                <td className="figure px-5 py-3 text-right">
                  {s.startingPrice === null ? (
                    <span className="font-sans text-text-faint">ยังไม่มีแพ็กเกจ</span>
                  ) : (
                    <>
                      {formatBaht(s.startingPrice)}
                      <span className="font-sans text-caption text-text-muted">
                        /{s.startingCycle === "monthly" ? "เดือน" : "ปี"}
                      </span>
                    </>
                  )}
                </td>
                <td className="figure px-5 py-3 text-right">{s.planCount}</td>
                <td className="figure px-5 py-3 text-right">{s.subscriberCount}</td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-2 text-caption">
                    <span
                      aria-hidden
                      className={`size-2 rounded-full ${s.isActive ? "bg-paid" : "bg-text-faint"}`}
                    />
                    {s.isActive ? "แสดงอยู่" : "ซ่อนอยู่"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {services.length === 0 && (
          <p className="px-5 py-8 text-text-muted">
            {filtered ? "ไม่พบบริการที่ตรงกับคำค้น ลองคำอื่นหรือเลือกทุกหมวด" : "ยังไม่มีบริการในคลัง"}
          </p>
        )}
      </div>
    </>
  );
}
