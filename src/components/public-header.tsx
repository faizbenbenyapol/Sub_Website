import Link from "next/link";
import { getCurrentUser } from "@/server/auth";
import { listNotifications } from "@/server/services/notifications";
import { AppNav } from "./app-nav";

/**
 * แถบบนของหน้าที่คนไม่ล็อกอินเข้าได้ (landing, รวมบริการ)
 * ล็อกอินอยู่แล้วใช้เมนูหลักตัวเดียวกับหน้าผู้ใช้ — กดเข้ารวมบริการจากเมนูแล้วเมนูไม่หายไป
 * หน้าที่ใช้ header นี้ต้องเว้นที่ล่าง pb-28 lg:pb-16 ให้แถบเมนูล่างบนมือถือ
 */
export async function PublicHeader() {
  const user = await getCurrentUser();
  if (user?.status === "active") {
    const { unreadCount } = await listNotifications(user.id, { unreadOnly: true, limit: 1 });
    return <AppNav isAdmin={user.role === "admin"} unreadCount={unreadCount} />;
  }
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
          รวมบริการ
        </Link>
        <Link href="/login" className="flex min-h-11 items-center rounded-control px-3 hover:bg-glass-strong">
          เข้าสู่ระบบ
        </Link>
        <Link
          href="/register"
          className="hidden h-11 items-center rounded-control bg-paid px-4 font-display font-semibold text-night sm:inline-flex"
        >
          สมัครสมาชิก
        </Link>
      </nav>
    </header>
  );
}
