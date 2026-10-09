import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/change-password-form";
import { FeedbackForm } from "@/components/feedback-form";
import { FeedbackProgress } from "@/components/feedback-progress";
import { NotificationSettingsForm, TestEmailButton } from "@/components/settings-form";
import { formatThaiDateTime } from "@/lib/dates";
import { FEEDBACK_KIND_LABEL } from "@/lib/validation/feedback";
import { getCurrentUser } from "@/server/auth";
import { env } from "@/server/env";
import { listMyFeedback } from "@/server/services/feedback";
import { settingsOf } from "@/server/services/notifications";

export const metadata: Metadata = { title: "ตั้งค่า" };

/** ตั้งค่าแจ้งเตือน + ส่งอีเมลทดสอบ (US-E1, E4) + เปลี่ยนรหัสผ่าน + รายงานปัญหา/คำแนะนำถึงผู้พัฒนา */
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const consoleMode = env.MAIL_TRANSPORT === "console";
  const sent = await listMyFeedback(user.id);

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
          ส่งอีเมลสรุปรายการที่จะตัดเงินใน 30 วันข้างหน้าไปที่ <span className="text-text">{user.email}</span>{" "}
          ทันที ไว้เช็กว่าได้รับอีเมลจากเรา ถ้าไม่เห็นในกล่องจดหมาย ลองดูในโฟลเดอร์จดหมายขยะ
        </p>
        {/* รายละเอียดการตั้งค่าเซิร์ฟเวอร์ — เห็นเฉพาะ admin ผู้ใช้ทั่วไปไม่ต้องรู้เรื่องนี้ */}
        {consoleMode && user.role === "admin" && (
          <p className="mt-2 border-l-[3px] border-due pl-3 text-caption text-text">
            สำหรับผู้ดูแล: เซิร์ฟเวอร์ตั้งเป็นโหมด console อยู่ อีเมลจะแสดงใน log แทนการส่งจริง — ตั้ง
            MAIL_TRANSPORT=smtp และ App Password ของ Gmail ใน .env เพื่อส่งจริง
          </p>
        )}
        <div className="mt-4">
          <TestEmailButton consoleMode={consoleMode} isAdmin={user.role === "admin"} />
        </div>
      </section>

      <section aria-labelledby="password-heading" className="glass mt-10 rounded-card p-5 md:p-6">
        <h2 id="password-heading" className="text-h3 font-bold">
          {user.passwordHash ? "เปลี่ยนรหัสผ่าน" : "ตั้งรหัสผ่าน"}
        </h2>
        <p className="mt-1 text-text-muted">
          {user.passwordHash
            ? "ยืนยันรหัสผ่านเดิมก่อน แล้วจึงตั้งรหัสใหม่ได้"
            : "บัญชีนี้เข้าด้วย Google ตั้งรหัสผ่านไว้เพื่อเข้าด้วยอีเมลได้อีกทาง"}
        </p>
        <div className="mt-5 max-w-md">
          <ChangePasswordForm hasPassword={Boolean(user.passwordHash)} />
        </div>
      </section>

      <section aria-labelledby="feedback-heading" className="glass mt-10 rounded-card p-5 md:p-6">
        <h2 id="feedback-heading" className="text-h3 font-bold">
          แจ้งปัญหา / ส่งคำแนะนำ
        </h2>
        <p className="mt-1 text-text-muted">เจออะไรแปลก ๆ หรืออยากให้มีอะไรเพิ่ม บอกทีมพัฒนาได้ที่นี่</p>
        <div className="mt-5">
          <FeedbackForm />
        </div>

        {sent.length > 0 && (
          <div className="mt-8 border-t border-line pt-5">
            <h3 className="text-caption font-medium text-text-muted">ที่เคยส่ง</h3>
            <ul className="mt-3 flex flex-col gap-5">
              {sent.map((f) => (
                <li key={f.id} className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="line-clamp-2 break-words">{f.message}</p>
                      <p className="mt-0.5 text-caption text-text-muted">
                        {FEEDBACK_KIND_LABEL[f.kind]} · {formatThaiDateTime(f.createdAt)}
                      </p>
                    </div>
                    {/* ยังไม่อยู่ในขั้นใด: บอกแค่ว่าทีมเห็นหรือยัง */}
                    {(f.status === "new" || f.status === "read") && (
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-caption ${
                          f.status === "read"
                            ? "bg-glass-strong text-text"
                            : "border border-line text-text-muted"
                        }`}
                      >
                        {f.status === "new" ? "รอทีมอ่าน" : "ทีมอ่านแล้ว"}
                      </span>
                    )}
                  </div>
                  <FeedbackProgress status={f.status} />
                  {f.reply && (
                    <div className="rounded-control border-l-[3px] border-paid bg-glass-strong px-3 py-2">
                      <p className="text-caption font-medium text-paid">
                        ทีมพัฒนาตอบ{f.repliedAt && ` · ${formatThaiDateTime(f.repliedAt)}`}
                      </p>
                      <p className="mt-0.5 break-words whitespace-pre-line">{f.reply}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
