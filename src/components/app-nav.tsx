"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./logout-button";

// เมนูฝั่งผู้ใช้ (docs/03 ข้อ 6): มือถือเป็นแถบล่าง + ปุ่ม + เพิ่มรายการกลางแถบ, desktop เป็นแถบบน
// ปฏิทินและตั้งค่าจะเพิ่มในวันที่ 6

const ITEMS = [
  { href: "/dashboard", label: "ภาพรวม" },
  { href: "/subscriptions", label: "รายการ" },
  { href: "/services", label: "คลังบริการ" },
];

/** path นี้อยู่ใต้เมนูไหน (หน้าเพิ่มรายการไม่นับเป็นเมนู "รายการ") */
function isActive(pathname: string, href: string) {
  if (pathname === "/subscriptions/new") return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const addActive = pathname === "/subscriptions/new";

  return (
    <>
      <header className="bar sticky top-0 z-20 border-b border-line">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-6 px-4 md:px-8">
          <Link href="/dashboard" className="font-display text-lead font-bold">
            ตัดยัง?
          </Link>
          <nav aria-label="เมนูหลัก" className="hidden md:block">
            <ul className="flex gap-1">
              {ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(pathname, item.href) ? "page" : undefined}
                    className={`flex min-h-11 items-center rounded-control px-3 ${
                      isActive(pathname, item.href)
                        ? "bg-glass-strong font-semibold"
                        : "text-text-muted hover:text-text"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {isAdmin && (
              <Link
                href="/admin"
                className="min-h-11 content-center rounded-control px-3 text-caption text-text-muted hover:text-text"
              >
                หลังบ้าน
              </Link>
            )}
            <Link
              href="/subscriptions/new"
              className="hidden h-11 items-center rounded-control bg-paid px-4 font-display font-semibold text-night md:inline-flex"
            >
              เพิ่มรายการ
            </Link>
            <span className="hidden max-w-40 truncate text-text-muted lg:block">{name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* แถบล่างบนมือถือ — ปุ่มเพิ่มรายการอยู่กลาง ในระยะนิ้วโป้ง */}
      <nav aria-label="เมนูหลัก" className="bar fixed inset-x-0 bottom-0 z-20 border-t border-line md:hidden">
        <ul className="mx-auto grid h-16 max-w-md grid-cols-4 items-center px-2 pb-[env(safe-area-inset-bottom)]">
          {ITEMS.slice(0, 2).map((item) => (
            <MobileItem key={item.href} {...item} active={isActive(pathname, item.href)} />
          ))}
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
          <MobileItem {...ITEMS[2]} active={isActive(pathname, ITEMS[2].href)} />
        </ul>
      </nav>
    </>
  );
}

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
