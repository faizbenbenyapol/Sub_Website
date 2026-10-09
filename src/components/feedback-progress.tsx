import { FEEDBACK_STATUS_LABEL, FEEDBACK_STEPS, type FeedbackStatus } from "@/lib/validation/feedback";

/**
 * แถบความคืบหน้า 3 ขั้นของเรื่องที่แจ้ง: รับเรื่อง → กำลังแก้ไข → แก้ไขเรียบร้อย
 * ขั้นที่ผ่านแล้ว/ขั้นปัจจุบันเป็นสีเขียว ขั้นถัดไปเป็นเทา · ข้อความที่ไม่ได้อยู่ในขั้นใด (ใหม่/อ่านแล้ว) ไม่แสดงแถบนี้
 */
export function FeedbackProgress({ status }: { status: FeedbackStatus }) {
  const current = FEEDBACK_STEPS.indexOf(status as (typeof FEEDBACK_STEPS)[number]);
  if (current < 0) return null;
  return (
    <ol aria-label={`ความคืบหน้า: ${FEEDBACK_STATUS_LABEL[status]}`} className="flex items-center gap-1.5">
      {FEEDBACK_STEPS.map((step, i) => {
        const reached = i <= current;
        return (
          <li key={step} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className={`h-px w-4 ${reached ? "bg-paid" : "bg-line-strong"}`} />}
            <span
              aria-current={i === current ? "step" : undefined}
              className={`flex items-center gap-1 text-caption whitespace-nowrap ${
                i === current ? "font-semibold text-paid" : reached ? "text-text" : "text-text-faint"
              }`}
            >
              <span
                aria-hidden
                className={`flex size-4 items-center justify-center rounded-full text-[10px] font-bold ${
                  reached ? "bg-paid text-night" : "border border-line-strong"
                }`}
              >
                {i < current ? "✓" : i + 1}
              </span>
              {FEEDBACK_STATUS_LABEL[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
