"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { formatThaiDateTime } from "@/lib/dates";
import { FEEDBACK_STATUS_LABEL, FEEDBACK_STEPS, type FeedbackStatus } from "@/lib/validation/feedback";

type Status = FeedbackStatus;

/**
 * ส่วนจัดการข้อความในหลังบ้าน: พิมพ์ตอบกลับผู้ส่ง และขยับขั้น รับเรื่อง → กำลังแก้ไข → แก้ไขเรียบร้อย
 * ตอบแล้วผู้ส่งเห็นคำตอบในหน้าตั้งค่า + ได้แจ้งเตือนที่กระดิ่ง · ตอบซ้ำได้ (ทับคำตอบเดิม)
 */
export function FeedbackAdminControls({
  id,
  status,
  reply,
  repliedAt,
}: {
  id: number;
  status: Status;
  reply: string | null;
  repliedAt: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(!reply);
  const [error, setError] = useState<string>();

  /** ส่งการเปลี่ยนสถานะ/คำตอบไป server แล้วโหลดหน้าใหม่ คืน true เมื่อสำเร็จ */
  async function patch(body: { status?: Status; reply?: string }, done: string) {
    setPending(true);
    const res = await apiFetch(`/api/admin/feedback/${id}`, { method: "PATCH", body });
    setPending(false);
    if (!res.ok) {
      if (res.error.fields?.reply) setError(res.error.fields.reply);
      else toast(res.error.message, "error");
      return false;
    }
    toast(done);
    router.refresh();
    return true;
  }

  /** ส่งคำตอบถึงผู้ใช้ (ว่างไม่ได้) สำเร็จแล้วปิดช่องพิมพ์ */
  async function sendReply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = String(new FormData(e.currentTarget).get("reply") ?? "").trim();
    if (!text) return setError("พิมพ์คำตอบก่อนส่ง");
    setError(undefined);
    if (await patch({ reply: text }, "ส่งคำตอบแล้ว ผู้ใช้จะเห็นที่กระดิ่งแจ้งเตือน")) setEditing(false);
  }

  const replyId = `reply-${id}`;
  return (
    <div className="flex flex-col gap-4">
      {reply && !editing && (
        <div className="rounded-control border-l-[3px] border-paid bg-glass-strong px-4 py-3">
          <p className="text-caption text-text-muted">
            คำตอบของทีม{repliedAt && ` · ${formatThaiDateTime(repliedAt)}`}
          </p>
          <p className="mt-1 break-words whitespace-pre-line">{reply}</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-1 min-h-11 text-caption text-link underline underline-offset-4"
          >
            แก้คำตอบ
          </button>
        </div>
      )}

      {editing && (
        <form onSubmit={sendReply} noValidate className="flex flex-col gap-2">
          <label htmlFor={replyId} className="text-caption font-medium">
            {reply ? "แก้คำตอบ" : "ตอบกลับผู้ใช้"}
          </label>
          <textarea
            id={replyId}
            name="reply"
            defaultValue={reply ?? ""}
            maxLength={2000}
            rows={3}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${replyId}-error` : undefined}
            placeholder="เช่น ขอบคุณที่แจ้งครับ แก้ให้แล้วในเวอร์ชันล่าสุด"
            className={`rounded-control border bg-glass-strong px-4 py-3 text-text placeholder:text-text-faint focus:outline-none focus-visible:outline-2 focus-visible:outline-paid ${
              error ? "border-danger" : "border-line-strong focus:border-paid"
            }`}
          />
          {error && (
            <p id={`${replyId}-error`} className="text-caption text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending} className="h-11">
              {pending ? "กำลังส่ง…" : "ส่งคำตอบ"}
            </Button>
            {reply && (
              <Button type="button" variant="secondary" className="h-11" onClick={() => setEditing(false)}>
                ยกเลิก
              </Button>
            )}
          </div>
        </form>
      )}

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <p id={`steps-${id}`} className="text-caption text-text-muted">
          ความคืบหน้าที่ผู้ใช้เห็น (ไม่ต้องเลือกถ้าเป็นคำชมหรือแค่ตอบกลับ)
        </p>
        <div role="group" aria-labelledby={`steps-${id}`} className="flex flex-wrap items-center gap-2">
          {FEEDBACK_STEPS.map((step, i) => {
            const active = status === step;
            return (
              <button
                key={step}
                type="button"
                disabled={pending}
                aria-pressed={active}
                onClick={() =>
                  // กดขั้นเดิมซ้ำ = เอาออกจากการติดตาม (กลับเป็น "อ่านแล้ว")
                  active
                    ? patch({ status: "read" }, "เอาออกจากความคืบหน้าแล้ว")
                    : patch(
                        { status: step },
                        `ตั้งเป็น "${FEEDBACK_STATUS_LABEL[step]}" แล้ว ผู้ใช้จะได้แจ้งเตือน`,
                      )
                }
                className={`flex min-h-11 items-center gap-2 rounded-control border px-3 text-caption font-medium disabled:opacity-50 ${
                  active
                    ? "border-paid bg-paid text-night"
                    : "border-line text-text-muted hover:border-line-strong hover:text-text"
                }`}
              >
                <span aria-hidden className="figure">
                  {i + 1}
                </span>
                {FEEDBACK_STATUS_LABEL[step]}
              </button>
            );
          })}
          {status === "new" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => patch({ status: "read" }, "ทำเครื่องหมายว่าอ่านแล้ว")}
              className="min-h-11 px-2 text-caption text-link underline underline-offset-4 disabled:opacity-50"
            >
              แค่อ่านแล้ว
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
