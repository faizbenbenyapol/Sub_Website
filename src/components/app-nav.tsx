"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./logout-button";

// เมนูฝั่งผู้ใช้ (docs/03 ข้อ 6)
// มือถือ: แถบล่าง ภาพรวม · รายการ · [+] · ปฏิทิน · ตั้งค่า — ปุ่มเพิ่มรายการกลางแถบในระยะนิ้วโป้ง
// desktop (lg+): แถบบน มีหารค่าบริการ + รวมบริการเพิ่ม เพราะที่ว่างพอ (มือถือ/แท็บเล็ตเข้ากลุ่มหารจากหน้ารายการ)
// ทุกปุ่มบนแถบบนเป็น whitespace-nowrap — ไม่ให้คำไทยหักเป็นสองบรรทัดเมื่อที่แคบ

const DESKTOP_ITEMS = [
  { href: "/dashboard", label: "ภาพรวม" },
  { href: "/subscriptions", label: "รายการ" },
  { href: "/groups", label: "หารค่าบริการ" },
  { href: "/calendar", label: "ปฏิทิน" },
  { href: "/services", label: "รวมบริการ" },
  { href: "/settings", label: "ตั้งค่า" },
];

/** path นี้อยู่ใต้เมนูไหน (หน้าเพิ่มรายการไม่นับเป็นเมนู "รายการ") */
function isActive(pathname: string, href: string) {
  if (pathname === "/subscriptions/new") return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** แถบเมนูของผู้ใช้ที่ล็อกอินแล้ว: จอใหญ่เป็นแถบบน มือถือ/แท็บเล็ตเป็นแถบล่างพร้อมปุ่ม + กลางแถบ */
export function AppNav({ isAdmin, unreadCount }: { isAdmin: boolean; unreadCount: number }) {
  const pathname = usePathname();
  const addActive = pathname === "/subscriptions/new";

  return (
    <>
      <header className="bar sticky top-0 z-20 border-b border-line">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-4 px-4 md:px-8 lg:gap-6">
          <Link href="/dashboard" className="shrink-0 font-display text-lead font-bold whitespace-nowrap">
            ตัดยัง?
          </Link>
          <nav aria-label="เมนูหลัก" className="hidden lg:block">
            <ul className="flex gap-1">
              {DESKTOP_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center rounded-control px-2.5 whitespace-nowrap xl:px-3 ${
                        active ? "bg-glass-strong font-semibold" : "text-text-muted hover:text-text"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Bell count={unreadCount} active={pathname === "/notifications"} />
            {isAdmin && (
              <Link
                href="/admin"
                className="hidden min-h-11 content-center rounded-control px-2.5 text-caption whitespace-nowrap text-text-muted hover:text-text sm:block"
              >
                หลังบ้าน
              </Link>
            )}
            <Link
              href="/subscriptions/new"
              className="ml-1 hidden h-11 items-center rounded-control bg-paid px-4 font-display font-semibold whitespace-nowrap text-night lg:inline-flex"
            >
              เพิ่มรายการ
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <nav aria-label="เมนูหลัก" className="bar fixed inset-x-0 bottom-0 z-20 border-t border-line lg:hidden">
        <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-1 pb-[env(safe-area-inset-bottom)]">
          <MobileItem href="/dashboard" label="ภาพรวม" active={isActive(pathname, "/dashboard")} />
          <MobileItem href="/subscriptions" label="รายการ" active={isActive(pathname, "/subscriptions")} />
          <li className="flex justify-center">
            <Link
              href="/subscriptions/new"
              aria-current={addActive ? "page" : undefined}
              className="-mt-6 flex size-14 items-center justify-center rounded-full bg-paid text-night shadow-[0_6px_20px_rgb(200_241_105/0.35)]"
            >
              <span aria-hidden className="text-h3 leading-none font-bold">
                +
              </span>
              <span className="sr-only">เพิ่มรายการ</span>
            </Link>
          </li>
          <MobileItem href="/calendar" label="ปฏิทิน" active={isActive(pathname, "/calendar")} />
          <MobileItem href="/settings" label="ตั้งค่า" active={isActive(pathname, "/settings")} />
        </ul>
      </nav>
    </>
  );
}

/** กระดิ่ง: ตัวเลขการแจ้งเตือนที่ยังไม่อ่าน (US-E3) — label บอกจำนวนให้ screen reader */
function Bell({ count, active }: { count: number; active: boolean }) {
  return (
    <Link
      href="/notifications"
      aria-label={count > 0 ? `การแจ้งเตือน ${count} รายการที่ยังไม่อ่าน` : "การแจ้งเตือน"}
      aria-current={active ? "page" : undefined}
      className={`relative flex size-11 items-center justify-center rounded-control hover:bg-glass-strong ${
        active ? "bg-glass-strong" : ""
      }`}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" strokeLinejoin="round" />
        <path d="M10 20.5a2 2 0 0 0 4 0" strokeLinecap="round" />
      </svg>
      {count > 0 && (
        <span className="figure absolute top-1 right-1 flex min-w-5 items-center justify-center rounded-full bg-due px-1 text-[11px] leading-5 font-semibold text-night">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

/** ปุ่มหนึ่งช่องในแถบเมนูล่างบนมือถือ (จุดเขียวบอกหน้าปัจจุบัน) */
function MobileItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-12 flex-col items-center justify-center text-caption ${
          active ? "font-semibold text-text" : "text-text-muted"
        }`}
      >
        <span aria-hidden className={`mb-1 size-1.5 rounded-full ${active ? "bg-paid" : "bg-transparent"}`} />
        {label}
      </Link>
    </li>
  );
}
