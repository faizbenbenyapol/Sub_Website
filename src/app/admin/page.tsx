import type { Metadata } from "next";

export const metadata: Metadata = { title: "หลังบ้าน" };

// หน้าชั่วคราว — CRUD คลังทำวันที่ 4, Dashboard admin วันที่ 6
export default function AdminHome() {
  return (
    <main className="mx-auto max-w-[1120px] px-4 py-10 md:px-8">
      <h1 className="text-h2 font-bold">หลังบ้าน</h1>
      <p className="mt-2 text-text-muted">จัดการหมวด บริการ และแพ็กเกจ — เริ่มวันที่ 4</p>
    </main>
  );
}
