import Link from "next/link";
import { getCurrentUser } from "@/server/auth";

/** แถบบนของหน้าที่คนไม่ล็อกอินเข้าได้ (landing, คลังบริการ) — ปุ่มขวาเปลี่ยนตามสถานะล็อกอิน */
export async function PublicHeader() {
  const user = await getCurrentUser();
  const signedIn = user?.status === "active";
  return (
    <header className="mx-auto flex h-16 max-w-[1120px] items-center gap-4 px-4 md:px-8">
      <Link href="/" className="font-display text-lead font-bold">
        ตัดยัง?
      </Link>
      <nav aria-label="เมนู" className="ml-auto flex items-center gap-1">
        <Link
          href="/services"
          className="flex min-h-11 items-center rounded-control px-3 text-text-muted hover:text-text"
        >
          คลังบริการ
        </Link>
        {signedIn ? (
          <Link
            href={user.role === "admin" ? "/admin" : "/dashboard"}
            className="inline-flex h-11 items-center rounded-control bg-paid px-4 font-display font-semibold text-night"
          >
            ไปที่ภาพรวม
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="flex min-h-11 items-center rounded-control px-3 hover:bg-glass-strong"
            >
              เข้าสู่ระบบ
            </Link>
            <Link
              href="/register"
              className="hidden h-11 items-center rounded-control bg-paid px-4 font-display font-semibold text-night sm:inline-flex"
            >
              สมัครสมาชิก
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
