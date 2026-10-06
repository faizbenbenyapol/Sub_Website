import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = { title: "ภาพรวม" };

// หน้าชั่วคราว — Dashboard จริงทำวันที่ 6 ตาม docs/03-design.md ข้อ 6
export default async function DashboardPage() {
  const user = await getCurrentUser();
  return (
    <main>
      <h1 className="text-h2 font-bold">สวัสดี {user?.name}</h1>
      <p className="mt-2 text-text-muted">หน้าภาพรวมจะมาในวันที่ 6 — ตอนนี้ดูรายการทั้งหมดได้ที่หน้ารายการ</p>
      <Link
        href="/subscriptions"
        className="mt-4 inline-block font-medium text-link underline underline-offset-4"
      >
        ไปที่รายการของฉัน
      </Link>
    </main>
  );
}
