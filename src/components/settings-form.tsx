"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";

const DAYS = [1, 3, 7] as const;

/** ตั้งค่าแจ้งเตือนทางอีเมล (US-E1) */
export function NotificationSettingsForm({
  initial,
}: {
  initial: { notifyEnabled: boolean; notifyDaysBefore: 1 | 3 | 7 };
}) {
  const router = useRouter();
  const toast = useToast();
  const [enabled, setEnabled] = useState(initial.notifyEnabled);
  const [pending, setPending] = useState(false);

  /** บันทึกเปิด/ปิดการแจ้งเตือนและจำนวนวันล่วงหน้า */
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const days = Number(new FormData(e.currentTarget).get("notifyDaysBefore")) as 1 | 3 | 7;
    setPending(true);
    const res = await apiFetch("/api/me/settings", {
      method: "PATCH",
      body: { notifyEnabled: enabled, notifyDaysBefore: days },
    });
    setPending(false);
    if (!res.ok) return toast(res.error.message, "error");
    toast(enabled ? `บันทึกแล้ว — จะเตือนล่วงหน้า ${days} วัน` : "ปิดการแจ้งเตือนทางอีเมลแล้ว");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <CheckboxField
        label="ส่งอีเมลเตือนก่อนตัดเงิน"
        description="และก่อนช่วงทดลองใช้ฟรีหมด ระบบเช็กทุกวันตอน 08:00"
        checked={enabled}
        onChange={(e) => setEnabled(e.target.checked)}
      />
      <fieldset disabled={!enabled} className="disabled:opacity-50">
        <legend className="text-caption font-medium">เตือนล่วงหน้า</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <label
              key={d}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line px-4 has-[:checked]:border-paid has-[:checked]:bg-glass-strong"
            >
              <input
                type="radio"
                name="notifyDaysBefore"
                value={d}
                defaultChecked={initial.notifyDaysBefore === d}
                className="size-4 accent-paid"
              />
              {d} วัน
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <Button type="submit" disabled={pending}>
          บันทึกการตั้งค่า
        </Button>
      </div>
    </form>
  );
}

/**
 * ปุ่มส่งอีเมลทดสอบทันที (US-E4)
 * โหมด console (ยังไม่ได้ตั้งค่าส่งอีเมลจริง): admin ได้ข้อความเทคนิค ผู้ใช้ทั่วไปได้ภาษาธรรมดาว่ายังส่งไม่ได้
 */
export function TestEmailButton({ consoleMode, isAdmin }: { consoleMode: boolean; isAdmin: boolean }) {
  const toast = useToast();
  const [pending, setPending] = useState(false);

  /** สั่งส่งอีเมลทดสอบทันที แล้วบอกผลตามโหมดการส่งของเซิร์ฟเวอร์ */
  async function send() {
    setPending(true);
    const res = await apiFetch<{ sentTo: string; itemCount: number }>("/api/me/notifications/test", {
      method: "POST",
    });
    setPending(false);
    if (!res.ok) return toast(res.error.message, "error");
    if (!consoleMode)
      return toast(`ส่งอีเมลทดสอบไปที่ ${res.data.sentTo} แล้ว (${res.data.itemCount} รายการ)`);
    toast(
      isAdmin
        ? `สร้างอีเมลทดสอบแล้ว (${res.data.itemCount} รายการ) — โหมด console ดูได้ใน log ของเซิร์ฟเวอร์`
        : "ตอนนี้ระบบยังไม่ได้เปิดการส่งอีเมลจริง จึงยังไม่มีอีเมลเข้ากล่องจดหมาย",
      isAdmin ? undefined : "error",
    );
  }

  return (
    <Button variant="secondary" onClick={send} disabled={pending}>
      {pending ? "กำลังส่ง…" : "ส่งอีเมลทดสอบ"}
    </Button>
  );
}
