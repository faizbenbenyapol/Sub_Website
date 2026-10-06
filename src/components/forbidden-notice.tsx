import Link from "next/link";

/** หน้า 403 เดียวกันทั้งเว็บ (docs/03-design.md ข้อ 7) */
export function ForbiddenNotice() {
  return (
    <main className="mx-auto max-w-[1120px] px-4 py-16 md:px-8">
      <p className="figure text-h3 text-due">403</p>
      <h1 className="mt-2 text-h2 font-bold">หน้านี้สำหรับผู้ดูแลระบบ</h1>
      <p className="mt-2 text-text-muted">บัญชีของคุณไม่มีสิทธิ์เข้าหน้านี้</p>
      <Link
        href="/dashboard"
        className="mt-6 inline-block font-medium text-link underline underline-offset-4"
      >
        กลับไปหน้าภาพรวม
      </Link>
    </main>
  );
}
