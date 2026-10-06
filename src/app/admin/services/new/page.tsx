import type { Metadata } from "next";
import Link from "next/link";
import { ServiceForm } from "@/components/admin/service-form";
import { listCategories } from "@/server/services/catalog";

export const metadata: Metadata = { title: "เพิ่มบริการ · หลังบ้าน" };

/** หน้าเพิ่มบริการใหม่ */
export default async function NewServicePage() {
  return (
    <>
      <Link href="/admin/services" className="text-caption text-text-muted hover:text-text">
        ← บริการทั้งหมด
      </Link>
      <h1 className="mt-2 text-h2 font-bold">เพิ่มบริการ</h1>
      <p className="mt-1 text-text-muted">บันทึกบริการก่อน แล้วเพิ่มแพ็กเกจและราคาในหน้าถัดไป</p>
      <div className="glass mt-6 rounded-card p-5 md:p-6">
        <ServiceForm categories={await listCategories()} />
      </div>
    </>
  );
}
