// หน้าแรกชั่วคราว — ใช้ตรวจ design tokens จนกว่าจะทำ landing จริง (docs/03-design.md ข้อ 9)
export default function Home() {
  return (
    <main className="mx-auto flex max-w-[1120px] flex-col gap-12 px-4 py-16 md:px-8">
      <header className="max-w-[40rem]">
        <h1 className="text-h2 md:text-h1 font-bold">เดือนนี้โดนตัดเงินอะไรบ้าง?</h1>
        <p className="mt-3 text-text-muted">
          รวมทุกรายการไว้ที่เดียว เตือนทางอีเมลก่อนตัดเงิน และหารค่า Family plan กับเพื่อนด้วย QR พร้อมเพย์
        </p>
      </header>

      <section
        aria-label="ตัวอย่างยอดต่อเดือน"
        className="relative max-w-md overflow-hidden rounded-hero bg-slip p-6 md:p-8"
      >
        <span aria-hidden className="absolute -right-10 -top-10 size-36 rounded-full bg-due" />
        <span aria-hidden className="absolute -right-2 top-16 size-20 rounded-full bg-paid" />
        <p className="relative font-display text-lead font-semibold">เดือนนี้จ่าย</p>
        <p className="figure relative mt-1 text-[44px] leading-tight font-semibold md:text-figure">
          ฿1,247.00
        </p>
        <p className="relative mt-2 text-white/85">ปีละ ฿14,964 · 6 รายการ</p>
      </section>

      <div className="flex flex-wrap gap-3">
        <button className="h-12 rounded-control bg-paid px-6 font-display font-semibold text-night">
          เพิ่มรายการแรก
        </button>
        <button className="glass h-12 rounded-control border-line-strong px-6 font-display font-semibold">
          ดูคลังบริการ
        </button>
      </div>
    </main>
  );
}
