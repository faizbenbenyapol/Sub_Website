"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "ภาพรวม", exact: true },
  { href: "/admin/categories", label: "หมวดหมู่" },
  { href: "/admin/services", label: "บริการและแพ็กเกจ" },
  { href: "/admin/users", label: "ผู้ใช้" },
  { href: "/admin/feedback", label: "แจ้งปัญหา/คำแนะนำ" },
];

/**
 * เมนูหลังบ้าน: desktop เป็น sidebar ซ้าย, มือถือเป็นแถบเลื่อนแนวนอนใต้แถบบน
 * ไม่ทำ sticky: nav เป็นกล่อง overflow-x-auto (สำหรับมือถือ) sticky ข้างในจะติดกับกล่องนี้แทนหน้าจอ ทำให้เมนูถูกดันลงไม่เท่ากันแต่ละหน้า
 * · ตัวเลขส้ม = ข้อความแจ้งปัญหาที่ยังไม่อ่าน */
export function AdminNav({ newFeedback = 0 }: { newFeedback?: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="เมนูหลังบ้าน" className="relative -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
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
                {item.href === "/admin/feedback" && newFeedback > 0 && (
                  <span className="figure ml-2 rounded-full bg-due px-1.5 text-[11px] leading-5 font-semibold text-night">
                    {newFeedback > 99 ? "99+" : newFeedback}
                    <span className="sr-only"> ข้อความใหม่</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
