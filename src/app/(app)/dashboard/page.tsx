import type { Metadata } from "next";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = { title: "ภาพรวม" };

// หน้าชั่วคราว — Dashboard จริงทำวันที่ 6 ตาม docs/03-design.md ข้อ 6
export default async function DashboardPage() {
  const user = await getCurrentUser();
  return (
    <main className="mx-auto max-w-[1120px] px-4 py-10 md:px-8">
      <h1 className="text-h2 font-bold">สวัสดี {user?.name}</h1>
      <p className="mt-2 text-text-muted">ยังไม่มีรายการ — หน้าภาพรวมจะมาในวันที่ 6</p>
    </main>
  );
}
