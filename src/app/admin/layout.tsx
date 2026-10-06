import { redirect } from "next/navigation";
import { ForbiddenNotice } from "@/components/forbidden-notice";
import { TopBar } from "@/components/top-bar";
import { getCurrentUser } from "@/server/auth";

/** กันหลังบ้านด้วย role จาก DB (proxy ตรวจจาก token ไปแล้วชั้นหนึ่ง) */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await getCurrentUser();
  if (!user || user.status !== "active") redirect("/login?next=/admin");
  if (user.role !== "admin") return <ForbiddenNotice />;
  return (
    <>
      <TopBar name={user.name} isAdmin home="/admin" />
      {children}
    </>
  );
}
