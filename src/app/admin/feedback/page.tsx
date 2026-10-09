import type { Metadata } from "next";
import Link from "next/link";
import { FeedbackAdminControls } from "@/components/admin/feedback-admin-controls";
import { formatThaiDateTime } from "@/lib/dates";
import { FEEDBACK_KIND_LABEL, FEEDBACK_STATUS_LABEL, type FeedbackStatus } from "@/lib/validation/feedback";
import { FEEDBACK_PAGE_SIZE, listFeedback } from "@/server/services/feedback";

export const metadata: Metadata = { title: "แจ้งปัญหา/คำแนะนำ · หลังบ้าน" };

// แท็บ = ชุดสถานะที่กรอง (key ใช้ใน ?tab=)
const TABS = [
  { key: "new", label: "ใหม่", statuses: ["new"] },
  { key: "doing", label: "กำลังดำเนินการ", statuses: ["acknowledged", "in_progress"] },
  { key: "done", label: "แก้ไขเรียบร้อย", statuses: ["resolved"] },
  { key: "read", label: "ตอบแล้ว/อ่านแล้ว", statuses: ["read"] },
  { key: "all", label: "ทั้งหมด", statuses: [] },
] as const satisfies readonly { key: string; label: string; statuses: readonly FeedbackStatus[] }[];

const EMPTY: Record<(typeof TABS)[number]["key"], string> = {
  new: "ไม่มีข้อความใหม่ อ่านครบแล้ว",
  doing: "ไม่มีเรื่องที่กำลังดำเนินการ",
  done: "ยังไม่มีเรื่องที่แก้ไขเรียบร้อย",
  read: "ยังไม่มีข้อความที่ตอบหรืออ่านไว้",
  all: "ยังไม่มีข้อความ",
};

const KIND_STYLE = {
  bug: "border-danger/60 text-danger",
  suggestion: "border-link/60 text-link",
  other: "border-line-strong text-text-muted",
} as const;

/** ข้อความที่ผู้ใช้ส่งจากหน้าตั้งค่า: อ่าน ตอบกลับ ขยับขั้น รับเรื่อง → กำลังแก้ไข → แก้ไขเรียบร้อย — เปิดมาที่แท็บ "ใหม่" */
export default async function AdminFeedbackPage({ searchParams }: PageProps<"/admin/feedback">) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const page = Math.max(1, Number(sp.page) || 1);
  const { data, meta } = await listFeedback({ statuses: [...tab.statuses], page });
  const pages = Math.max(1, Math.ceil(meta.total / FEEDBACK_PAGE_SIZE));
  /** ลิงก์ของแท็บและหน้าที่ */
  const href = (key: string, p = 1) =>
    `/admin/feedback?${new URLSearchParams({ tab: key, ...(p > 1 && { page: String(p) }) })}`;

  return (
    <>
      <h1 className="text-h2 font-bold">แจ้งปัญหา / คำแนะนำ</h1>
      <p className="mt-1 text-text-muted">ข้อความจากผู้ใช้ ส่งมาจากหน้าตั้งค่า</p>

      <nav aria-label="สถานะ" className="mt-6">
        <ul className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const active = tab.key === t.key;
            return (
              <li key={t.key}>
                <Link
                  href={href(t.key)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-control border px-4 ${
                    active
                      ? "border-paid bg-glass-strong font-semibold"
                      : "border-line text-text-muted hover:text-text"
                  }`}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {data.length === 0 ? (
        <p className="mt-8 text-text-muted">{EMPTY[tab.key]}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {data.map((f) => (
            <li key={f.id} className="glass rounded-card p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-caption font-medium ${KIND_STYLE[f.kind]}`}
                >
                  {FEEDBACK_KIND_LABEL[f.kind]}
                </span>
                <span className="font-medium">{f.user.name}</span>
                <span className="text-caption text-text-muted">{f.user.email}</span>
                <span className="ml-auto text-caption text-text-muted">
                  {formatThaiDateTime(f.createdAt)} · {FEEDBACK_STATUS_LABEL[f.status]}
                </span>
              </div>
              <p className="mt-3 break-words whitespace-pre-line">{f.message}</p>
              <div className="mt-4">
                <FeedbackAdminControls id={f.id} status={f.status} reply={f.reply} repliedAt={f.repliedAt} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="หน้า" className="mt-6 flex items-center gap-3">
          {page > 1 && (
            <Link href={href(tab.key, page - 1)} className="min-h-11 content-center text-link underline">
              ก่อนหน้า
            </Link>
          )}
          <span className="text-text-muted">
            หน้า {page} / {pages}
          </span>
          {page < pages && (
            <Link href={href(tab.key, page + 1)} className="min-h-11 content-center text-link underline">
              ถัดไป
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
