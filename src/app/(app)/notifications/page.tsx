import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NotificationList } from "@/components/notification-list";
import { getCurrentUser } from "@/server/auth";
import { listNotifications } from "@/server/services/notifications";

export const metadata: Metadata = { title: "การแจ้งเตือน" };

/** หน้าที่กระดิ่งพามา (US-E3) */
export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { data, unreadCount } = await listNotifications(user.id, { limit: 50 });
  return (
    <main className="max-w-2xl">
      <h1 className="text-h2 font-bold">การแจ้งเตือน</h1>
      <NotificationList items={data} unreadCount={unreadCount} />
    </main>
  );
}
