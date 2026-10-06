import type { Metadata } from "next";
import Link from "next/link";
import { listCategoriesAdmin, listServicesAdmin } from "@/server/services/admin-catalog";

export const metadata: Metadata = { title: "หลังบ้าน" };

// หน้าชั่วคราว — Dashboard admin (กราฟ/สถิติ) ทำวันที่ 6 ตาม US-H5
export default async function AdminHome() {
  const [cats, services] = await Promise.all([listCategoriesAdmin(), listServicesAdmin({})]);
  const hidden = services.filter((s) => !s.isActive).length;
  return (
    <>
      <h1 className="text-h2 font-bold">หลังบ้าน</h1>
      <p className="mt-2 text-text-muted">สถิติและกราฟภาพรวมระบบจะมาในวันที่ 6</p>
      <dl className="mt-8 grid max-w-xl grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <dt className="text-text-muted">หมวด</dt>
          <dd className="figure text-h2">{cats.length}</dd>
        </div>
        <div>
          <dt className="text-text-muted">บริการในคลัง</dt>
          <dd className="figure text-h2">
            {services.length}
            {hidden > 0 && (
              <span className="ml-2 font-sans text-caption text-text-muted">ซ่อนอยู่ {hidden}</span>
            )}
          </dd>
        </div>
      </dl>
      <Link
        href="/admin/services"
        className="mt-8 inline-block font-medium text-link underline underline-offset-4"
      >
        จัดการบริการและแพ็กเกจ
      </Link>
    </>
  );
}
