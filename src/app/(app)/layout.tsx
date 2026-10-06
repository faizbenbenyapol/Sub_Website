import { redirect } from "next/navigation";
import { TopBar } from "@/components/top-bar";
import { getCurrentUser } from "@/server/auth";

/** ชั้นที่สองของการกันหน้าผู้ใช้: โหลดผู้ใช้จาก DB จริง (บัญชีถูกลบ/ระงับจะถูกพาออกแม้ token ยังไม่หมดอายุ) */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user || user.status !== "active") redirect("/login");
  return (
    <>
      <TopBar name={user.name} isAdmin={user.role === "admin"} home="/dashboard" />
      {children}
    </>
  );
}
