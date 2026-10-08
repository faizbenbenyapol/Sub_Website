import type { Metadata } from "next";
import Link from "next/link";
import { UserStatusButton } from "@/components/admin/user-status-button";
import { formatThaiDateTime } from "@/lib/dates";
import { getCurrentUser } from "@/server/auth";
import { listUsers } from "@/server/services/admin-users";

export const metadata: Metadata = { title: "ผู้ใช้ · หลังบ้าน" };

/** รายชื่อผู้ใช้ + ค้นหา + ระงับ/เปิดใช้งาน (US-H4) — แสดงเฉพาะข้อมูลบัญชี ไม่มีรายการ subscription ส่วนตัว */
export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const [me, { data, meta }] = await Promise.all([getCurrentUser(), listUsers({ q, page })]);
  const pages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  const pageHref = (p: number) => `/admin/users?${new URLSearchParams({ ...(q && { q }), page: String(p) })}`;

  return (
    <>
      <h1 className="text-h2 font-bold">ผู้ใช้</h1>
      <p className="mt-1 text-text-muted">ทั้งหมด {meta.total.toLocaleString("th-TH")} บัญชี</p>

      <form role="search" className="mt-6 flex max-w-xl gap-2">
        <label htmlFor="user-q" className="sr-only">
          ค้นหาชื่อหรืออีเมล
        </label>
        <input
          id="user-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="ค้นหาชื่อหรืออีเมล"
          className="h-12 min-w-0 flex-1 rounded-control border border-line-strong bg-glass-strong px-4 placeholder:text-text-faint focus:border-paid focus:outline-none"
        />
        <button className="glass h-12 rounded-control border-line-strong px-5 font-display font-semibold">
          ค้นหา
        </button>
      </form>

      <div className="glass relative mt-6 overflow-x-auto rounded-card">
        <table className="w-full min-w-[640px] text-left">
          <thead className="text-caption text-text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="px-5 py-3 font-medium">
                ชื่อ
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                อีเมล
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                สมัครเมื่อ
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                สถานะ
              </th>
              <th scope="col" className="px-5 py-3">
                <span className="sr-only">จัดการ</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3 font-medium">
                  {u.name}
                  {u.role === "admin" && (
                    <span className="ml-2 text-caption text-text-muted">ผู้ดูแลระบบ</span>
                  )}
                </td>
                <td className="px-5 py-3 text-text-muted">{u.email}</td>
                <td className="px-5 py-3 text-caption text-text-muted">{formatThaiDateTime(u.createdAt)}</td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-2 text-caption">
                    <span
                      aria-hidden
                      className={`size-2 rounded-full ${u.status === "active" ? "bg-paid" : "bg-danger"}`}
                    />
                    {u.status === "active" ? "ใช้งานได้" : "ถูกระงับ"}
                  </span>
                </td>
                <td className="px-5 py-2 text-right">
                  {u.role !== "admin" && u.id !== me?.id && (
                    <UserStatusButton id={u.id} name={u.name} status={u.status} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && (
          <p className="px-5 py-8 text-text-muted">ไม่พบผู้ใช้ที่ตรงกับ &quot;{q}&quot;</p>
        )}
      </div>

      {pages > 1 && (
        <nav aria-label="หน้า" className="mt-4 flex items-center gap-2">
          {page > 1 && (
            <Link
              href={pageHref(page - 1)}
              className="flex min-h-11 items-center rounded-control border border-line px-4"
            >
              ก่อนหน้า
            </Link>
          )}
          <span className="text-caption text-text-muted">
            หน้า {page} จาก {pages}
          </span>
          {page < pages && (
            <Link
              href={pageHref(page + 1)}
              className="flex min-h-11 items-center rounded-control border border-line px-4"
            >
              ถัดไป
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
