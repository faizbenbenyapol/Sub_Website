import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { getCurrentUser } from "@/server/auth";

/** ชั้นที่สองของการกันหน้าผู้ใช้: โหลดผู้ใช้จาก DB จริง (บัญชีถูกลบ/ระงับจะถูกพาออกแม้ token ยังไม่หมดอายุ) */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user || user.status !== "active") redirect("/login");
  return (
    <>
      <AppNav name={user.name} isAdmin={user.role === "admin"} />
      {/* pb-24 กันเนื้อหาโดนแถบล่างบนมือถือบัง */}
      <div className="mx-auto max-w-[1120px] px-4 pt-6 pb-28 md:px-8 md:pt-10 md:pb-16">{children}</div>
    </>
  );
}
