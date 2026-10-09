"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextareaField } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { fieldErrors } from "@/lib/validation";
import { FEEDBACK_KIND_LABEL, feedbackCreateSchema } from "@/lib/validation/feedback";

const KINDS = ["bug", "suggestion", "other"] as const;

/** ฟอร์มรายงานปัญหา / ส่งคำแนะนำถึงผู้พัฒนา (หน้าตั้งค่า) — ส่งเข้าหลังบ้านของ admin */
export function FeedbackForm() {
  const router = useRouter();
  const toast = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [length, setLength] = useState(0);

  /** ส่งข้อความถึงทีม: ตรวจความยาวก่อน สำเร็จแล้วล้างฟอร์มและโหลดรายการที่เคยส่งใหม่ */
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const parsed = feedbackCreateSchema.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setPending(true);
    const res = await apiFetch("/api/feedback", { method: "POST", body: parsed.data });
    setPending(false);
    if (!res.ok) {
      if (res.error.fields) setErrors(res.error.fields);
      else toast(res.error.message, "error");
      return;
    }
    form.reset();
    setLength(0);
    toast("ส่งถึงทีมพัฒนาแล้ว ขอบคุณที่ช่วยบอก");
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <fieldset>
        <legend className="text-caption font-medium">เรื่องที่จะบอก</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <label
              key={k}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line px-4 has-[:checked]:border-paid has-[:checked]:bg-glass-strong"
            >
              <input
                type="radio"
                name="kind"
                value={k}
                defaultChecked={k === "bug"}
                className="size-4 accent-paid"
              />
              {FEEDBACK_KIND_LABEL[k]}
            </label>
          ))}
        </div>
        {errors.kind && <p className="mt-1.5 text-caption text-danger">{errors.kind}</p>}
      </fieldset>
      <TextareaField
        label="รายละเอียด"
        name="message"
        maxLength={2000}
        onChange={(e) => setLength(e.target.value.length)}
        placeholder="เช่น กดบันทึกรายการแล้วขึ้นข้อความผิดพลาด หรืออยากให้มีฟีเจอร์…"
        hint={`ถ้าเป็นปัญหา บอกว่าทำอะไรอยู่ที่หน้าไหน จะช่วยให้แก้ได้เร็ว · ${length.toLocaleString("th-TH")}/2,000`}
        error={errors.message}
      />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "กำลังส่ง…" : "ส่งถึงทีมพัฒนา"}
        </Button>
      </div>
    </form>
  );
}
