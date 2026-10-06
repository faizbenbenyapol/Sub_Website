import Link from "next/link";
import { PublicHeader } from "@/components/public-header";

// หน้าแรกชั่วคราว — landing จริง (docs/03-design.md ข้อ 9) ทำหลัง P0 ครบ
export default function Home() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex max-w-[1120px] flex-col gap-12 px-4 py-12 md:px-8 md:py-16">
        <header className="max-w-[40rem]">
          <h1 className="text-h2 font-bold md:text-h1">เดือนนี้โดนตัดเงินอะไรบ้าง?</h1>
          <p className="mt-3 text-text-muted">
            รวมทุกรายการไว้ที่เดียว เตือนทางอีเมลก่อนตัดเงิน และหารค่า Family plan กับเพื่อนด้วย QR พร้อมเพย์
          </p>
        </header>

        <section
          aria-label="ตัวอย่างยอดต่อเดือน"
          className="relative max-w-md overflow-hidden rounded-hero bg-slip p-6 md:p-8"
        >
          <span aria-hidden className="absolute -top-10 -right-10 size-36 rounded-full bg-due" />
          <span aria-hidden className="absolute top-16 -right-2 size-20 rounded-full bg-paid" />
          <p className="relative font-display text-lead font-semibold">เดือนนี้จ่าย</p>
          <p className="figure relative mt-1 text-[44px] leading-tight font-semibold md:text-figure">
            ฿1,247.00
          </p>
          <p className="relative mt-2 text-white/85">ปีละ ฿14,964 · 6 รายการ</p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/register"
            className="inline-flex h-12 items-center rounded-control bg-paid px-6 font-display font-semibold text-night"
          >
            สมัครแล้วเพิ่มรายการแรก
          </Link>
          <Link
            href="/services"
            className="glass inline-flex h-12 items-center rounded-control border-line-strong px-6 font-display font-semibold"
          >
            ดูคลังบริการ
          </Link>
        </div>
      </main>
    </>
  );
}
