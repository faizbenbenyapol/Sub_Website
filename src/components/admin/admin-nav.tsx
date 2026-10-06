"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "ภาพรวม", exact: true },
  { href: "/admin/categories", label: "หมวดหมู่" },
  { href: "/admin/services", label: "บริการและแพ็กเกจ" },
];

/** เมนูหลังบ้าน: desktop เป็น sidebar ซ้าย, มือถือเป็นแถบเลื่อนแนวนอนใต้แถบบน */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="เมนูหลังบ้าน" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-1 lg:sticky lg:top-24 lg:flex-col">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-control px-4 whitespace-nowrap ${
                  active ? "bg-glass-strong font-semibold text-text" : "text-text-muted hover:text-text"
                }`}
              >
                {active && <span aria-hidden className="mr-2 size-2 rounded-full bg-paid" />}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
