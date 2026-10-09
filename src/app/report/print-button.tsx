"use client";

import { useEffect } from "react";

/** รอฟอนต์โหลดครบก่อนเปิดหน้าต่างพิมพ์ ไม่งั้น PDF ได้ฟอนต์สำรอง */
async function printWhenReady() {
  await document.fonts.ready;
  window.print();
}

/**
 * ปุ่ม "บันทึกเป็น PDF" — มาจากลิงก์ดาวน์โหลด (?print=1) จะเปิดหน้าต่างพิมพ์ให้เองครั้งเดียว
 * เช็คจาก URL ไม่ใช่ prop: effect อาจรันซ้ำ (React Strict Mode ตอน dev) แต่รอบแรกลบ ?print=1 ไปแล้ว รอบหลังจึงไม่พิมพ์ซ้ำ
 * และกดย้อนกลับ/รีเฟรชก็ไม่เด้งอีก
 */
export function PrintButton() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("print") !== "1") return;
    url.searchParams.delete("print");
    window.history.replaceState(null, "", url);
    printWhenReady();
  }, []);

  return (
    <button
      type="button"
      onClick={printWhenReady}
      className="inline-flex h-11 items-center gap-2 rounded-control bg-paid px-4 font-display font-semibold text-night"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      บันทึกเป็น PDF
    </button>
  );
}
