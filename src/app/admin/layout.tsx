import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { ForbiddenNotice } from "@/components/forbidden-notice";
import { TopBar } from "@/components/top-bar";
import { getCurrentUser } from "@/server/auth";

/** กันหลังบ้านด้วย role จาก DB (proxy ตรวจจาก token ไปแล้วชั้นหนึ่ง) + เมนู sidebar */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await getCurrentUser();
  if (!user || user.status !== "active") redirect("/login?next=/admin");
  if (user.role !== "admin") return <ForbiddenNotice />;
  return (
    <>
      <TopBar name={user.name} isAdmin home="/admin" />
      <div className="mx-auto max-w-[1120px] px-4 py-6 md:px-8 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10 lg:py-10">
        <AdminNav />
        <main className="mt-6 lg:mt-0">{children}</main>
      </div>
    </>
  );
}
