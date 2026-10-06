import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NotificationSettingsForm, TestEmailButton } from "@/components/settings-form";
import { getCurrentUser } from "@/server/auth";
import { env } from "@/server/env";
import { settingsOf } from "@/server/services/notifications";

export const metadata: Metadata = { title: "ตั้งค่า" };

/** ตั้งค่าแจ้งเตือน + ส่งอีเมลทดสอบ (US-E1, E4) */
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const consoleMode = env.MAIL_TRANSPORT === "console";

  return (
    <main className="max-w-2xl">
      <h1 className="text-h2 font-bold">ตั้งค่า</h1>

      <section aria-labelledby="notify-heading" className="glass mt-6 rounded-card p-5 md:p-6">
        <h2 id="notify-heading" className="text-h3 font-bold">
          แจ้งเตือนทางอีเมล
        </h2>
        <p className="mt-1 text-text-muted">
          ส่งไปที่ <span className="text-text">{user.email}</span>
        </p>
        <div className="mt-5">
          <NotificationSettingsForm initial={settingsOf(user)} />
        </div>
      </section>

      <section aria-labelledby="test-heading" className="mt-8">
        <h2 id="test-heading" className="text-lead font-semibold">
          ลองส่งอีเมลตอนนี้
        </h2>
        <p className="mt-1 text-text-muted">
          ส่งสรุปรายการที่จะตัดเงินใน 30 วันข้างหน้าทันที โดยไม่ต้องรอ 08:00
        </p>
        {consoleMode && (
          <p className="mt-2 border-l-[3px] border-due pl-3 text-caption text-text">
            เซิร์ฟเวอร์ตั้งเป็นโหมด console อยู่ อีเมลจะแสดงใน log แทนการส่งจริง — ตั้ง MAIL_TRANSPORT=smtp
            และ App Password ของ Gmail ใน .env เพื่อส่งจริง
          </p>
        )}
        <div className="mt-4">
          <TestEmailButton consoleMode={consoleMode} />
        </div>
      </section>
    </main>
  );
}
