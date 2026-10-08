"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { MoneyField, SelectField } from "@/components/ui/fields";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { formatBaht, fromSatang, toSatang } from "@/lib/money";
import { splitEqual } from "@/lib/split";
import { fieldErrors } from "@/lib/validation";
import { groupCreateSchema, MAX_MEMBERS } from "@/lib/validation/group";

export type ShareableSubscription = { id: number; name: string; price: number; maxMembers: number | null };
type MemberRow = { key: number; name: string; email: string; amount: string };

let nextKey = 1;
const emptyRow = (): MemberRow => ({ key: nextKey++, name: "", email: "", amount: "" });

/**
 * สร้างกลุ่มหาร (US-F1): เลือกรายการ → PromptPay ID → วิธีหาร → สมาชิก
 * โหมดหารเท่ากันแสดงยอดต่อคนทันทีระหว่างพิมพ์ ให้เห็นก่อนกดบันทึก
 */
export function GroupCreateForm({
  subscriptions,
  defaultSubscriptionId,
  defaultPromptpayId,
}: {
  subscriptions: ShareableSubscription[];
  defaultSubscriptionId?: number;
  defaultPromptpayId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [subId, setSubId] = useState(defaultSubscriptionId ?? subscriptions[0]?.id);
  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [rows, setRows] = useState<MemberRow[]>([emptyRow()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const sub = subscriptions.find((s) => s.id === subId);
  const totalSatang = sub ? toSatang(sub.price) : 0;
  const equal = splitEqual(totalSatang, rows.length);
  const customSum = rows.reduce((s, r) => s + (Number(r.amount) > 0 ? toSatang(Number(r.amount)) : 0), 0);
  const ownerShare = mode === "equal" ? equal.owner : totalSatang - customSum;

  const update = (key: number, patch: Partial<MemberRow>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      subscriptionId: subId,
      promptpayId: String(form.get("promptpayId") ?? ""),
      splitMode: mode,
      members: rows.map((r) => ({
        name: r.name,
        email: r.email,
        ...(mode === "custom" && { amount: r.amount }),
      })),
    };
    const parsed = groupCreateSchema.safeParse(body);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setPending(true);
    const res = await apiFetch<{ id: number }>("/api/groups", { method: "POST", body: parsed.data });
    setPending(false);
    if (!res.ok) {
      if (res.error.fields) setErrors(res.error.fields);
      else toast(res.error.message, "error");
      return;
    }
    toast(`สร้างกลุ่มหาร ${sub?.name} แล้ว — ส่งลิงก์จ่ายเงินให้เพื่อนได้เลย`);
    router.push(`/groups/${res.data.id}`);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <SelectField
        label="หารรายการไหน"
        value={subId}
        onChange={(e) => setSubId(Number(e.target.value))}
        error={errors.subscriptionId}
        hint={sub?.maxMembers && sub.maxMembers > 1 ? `แพ็กเกจนี้ใช้ได้ ${sub.maxMembers} คน` : undefined}
      >
        {subscriptions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} · {formatBaht(s.price)}/เดือน
          </option>
        ))}
      </SelectField>

      <TextField
        label="PromptPay ID ของคุณ (รับเงิน)"
        name="promptpayId"
        inputMode="numeric"
        defaultValue={defaultPromptpayId}
        placeholder="0812345678"
        hint="แนะนำเบอร์มือถือ — เลขบัตรประชาชนก็ใช้ได้แต่จะอยู่ใน QR ที่เพื่อนสแกน"
        error={errors.promptpayId}
      />

      <fieldset>
        <legend className="text-caption font-medium">วิธีหาร</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["equal", "หารเท่ากัน (รวมคุณ)"],
              ["custom", "กำหนดยอดเอง"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line px-4 has-[:checked]:border-paid has-[:checked]:bg-glass-strong"
            >
              <input
                type="radio"
                name="splitMode"
                checked={mode === value}
                onChange={() => setMode(value)}
                className="size-4 accent-paid"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-caption font-medium">สมาชิก (ไม่ต้องมีบัญชีในระบบ)</legend>
        {rows.map((r, i) => (
          <div
            key={r.key}
            className="glass grid gap-3 rounded-control p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-start"
          >
            <TextField
              label={`ชื่อคนที่ ${i + 1}`}
              value={r.name}
              onChange={(e) => update(r.key, { name: e.target.value })}
              error={errors[`members.${i}.name`]}
            />
            <TextField
              label="อีเมล (ไม่บังคับ)"
              type="email"
              inputMode="email"
              value={r.email}
              onChange={(e) => update(r.key, { email: e.target.value })}
              error={errors[`members.${i}.email`]}
            />
            {mode === "custom" ? (
              <MoneyField
                label="ยอด"
                value={r.amount}
                onChange={(e) => update(r.key, { amount: e.target.value })}
                error={errors[`members.${i}.amount`]}
                className="sm:w-32"
              />
            ) : (
              <p className="flex flex-col gap-1.5 sm:w-32">
                <span className="text-caption font-medium">ยอด</span>
                <span className="figure flex h-12 items-center">{formatBaht(fromSatang(equal.member))}</span>
              </p>
            )}
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}
                className="min-h-11 self-end rounded-control px-3 text-danger hover:bg-glass-strong"
              >
                ลบ<span className="sr-only"> คนที่ {i + 1}</span>
              </button>
            )}
          </div>
        ))}
        {errors.members && <p className="text-caption text-danger">{errors.members}</p>}
        {rows.length < MAX_MEMBERS && (
          <button
            type="button"
            onClick={() => setRows((list) => [...list, emptyRow()])}
            className="min-h-11 self-start rounded-control font-medium text-link"
          >
            + เพิ่มสมาชิก
          </button>
        )}
      </fieldset>

      <p className="border-l-[3px] border-paid pl-3">
        ส่วนของคุณ{" "}
        <span className={`figure ${ownerShare < 0 ? "text-danger" : ""}`}>
          {formatBaht(fromSatang(ownerShare))}
        </span>
        {ownerShare < 0 && <span className="text-danger"> — ยอดของสมาชิกรวมกันเกินราคา</span>}
      </p>

      <div>
        <Button type="submit" disabled={pending || !sub}>
          {pending ? "กำลังสร้าง…" : "สร้างกลุ่มหาร"}
        </Button>
      </div>
    </form>
  );
}
