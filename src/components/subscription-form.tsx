"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { ServiceLogo } from "@/components/service-logo";
import { Button } from "@/components/ui/button";
import { MoneyField, SelectField } from "@/components/ui/fields";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { formatBaht } from "@/lib/money";
import { fieldErrors } from "@/lib/validation";
import { subscriptionCreateSchema, subscriptionUpdateSchema } from "@/lib/validation/subscription";
import type { CategoryDto, ServiceDetailDto } from "@/server/services/catalog";
import type { SubscriptionDto } from "@/server/services/subscriptions";

type Props = {
  services: ServiceDetailDto[];
  categories: CategoryDto[];
  today: string;
  initial?: SubscriptionDto;
  preselectSlug?: string;
};

type Mode = "pick" | "catalog" | "custom";
const CYCLE = { monthly: "ต่อเดือน", yearly: "ต่อปี" } as const;

/**
 * ฟอร์มเพิ่ม/แก้รายการ (US-C1, C2)
 * เพิ่มใหม่: เลือกบริการจากคลัง (เติมราคา/รอบบิลจากแพ็กเกจให้ แก้ได้) หรือ "เพิ่มเอง" ถ้าไม่มีในคลัง
 */
export function SubscriptionForm({ services, categories, today, initial, preselectSlug }: Props) {
  const router = useRouter();
  const toast = useToast();
  const editing = initial !== undefined;

  const initialService = initial?.service
    ? services.find((s) => s.id === initial.service!.id)
    : services.find((s) => s.slug === preselectSlug);
  const [mode, setMode] = useState<Mode>(
    editing ? (initial.isCustom ? "custom" : "catalog") : initialService ? "catalog" : "pick",
  );
  const [service, setService] = useState<ServiceDetailDto | undefined>(initialService);
  const [planId, setPlanId] = useState<number | undefined>(initial?.plan?.id ?? initialService?.plans[0]?.id);
  const [price, setPrice] = useState(
    initial ? initial.price.toFixed(2) : (initialService?.plans[0]?.price.toFixed(2) ?? ""),
  );
  const [cycle, setCycle] = useState<"monthly" | "yearly">(
    initial?.billingCycle ?? initialService?.plans[0]?.billingCycle ?? "monthly",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  /** เลือกบริการจากคลัง → เลือกแพ็กเกจแรกและเติมราคาให้ */
  function chooseService(s: ServiceDetailDto) {
    setService(s);
    setMode("catalog");
    choosePlan(s, s.plans[0]?.id);
  }

  /** เปลี่ยนแพ็กเกจ → ราคาและรอบบิลเปลี่ยนตามแพ็กเกจ */
  function choosePlan(s: ServiceDetailDto, id: number | undefined) {
    const plan = s.plans.find((p) => p.id === id);
    setPlanId(id);
    if (plan) {
      setPrice(plan.price.toFixed(2));
      setCycle(plan.billingCycle);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const common = {
      price: price.replace(/,/g, ""),
      billingCycle: cycle,
      nextBillingDate: form.nextBillingDate,
      trialEndsAt: form.trialEndsAt,
      paymentMethod: form.paymentMethod,
      note: form.note,
    };
    const body =
      mode === "custom"
        ? {
            source: "custom",
            customName: form.customName,
            customCategoryId: form.customCategoryId,
            ...common,
          }
        : { source: "catalog", planId, ...common };

    const parsed = editing
      ? subscriptionUpdateSchema.safeParse(withoutSource(body, initial!.isCustom))
      : subscriptionCreateSchema.safeParse(body);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    const res = editing
      ? await apiFetch<SubscriptionDto>(`/api/subscriptions/${initial!.id}`, {
          method: "PATCH",
          body: parsed.data,
        })
      : await apiFetch<SubscriptionDto>("/api/subscriptions", { method: "POST", body: parsed.data });
    setPending(false);
    if (!res.ok) {
      if (res.error.fields) setErrors(res.error.fields);
      else toast(res.error.message, "error");
      return;
    }
    toast(editing ? `บันทึก ${res.data.name} แล้ว` : `เพิ่ม ${res.data.name} แล้ว`);
    router.push("/subscriptions");
    router.refresh();
  }

  if (mode === "pick") {
    return <ServicePicker services={services} onPick={chooseService} onCustom={() => setMode("custom")} />;
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {mode === "catalog" && service && (
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">บริการและแพ็กเกจ</legend>
          <div className="flex items-center gap-3">
            <ServiceLogo name={service.name} logoUrl={service.logoUrl} />
            <p className="font-display text-lead font-semibold">{service.name}</p>
            {!editing && (
              <button
                type="button"
                onClick={() => setMode("pick")}
                className="ml-auto min-h-11 rounded-control px-3 text-link hover:bg-glass-strong"
              >
                เปลี่ยนบริการ
              </button>
            )}
          </div>
          <PlanChoices service={service} planId={planId} onChange={(id) => choosePlan(service, id)} />
          {errors.planId && <p className="text-caption text-danger">{errors.planId}</p>}
        </fieldset>
      )}

      {mode === "catalog" && !service && initial && (
        // บริการถูก admin ซ่อนไปแล้ว: ยังแก้ราคา/วันที่ได้ แต่เปลี่ยนแพ็กเกจไม่ได้
        <p className="text-text-muted">
          {initial.name} · {initial.plan?.name} (บริการนี้ไม่อยู่ในคลังแล้ว เปลี่ยนแพ็กเกจไม่ได้)
        </p>
      )}

      {mode === "custom" && (
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="ชื่อบริการ"
            name="customName"
            defaultValue={initial?.isCustom ? initial.name : ""}
            placeholder="เช่น ฟิตเนส, ค่าเน็ตบ้าน"
            error={errors.customName}
          />
          <SelectField
            label="หมวด"
            name="customCategoryId"
            defaultValue={
              initial?.isCustom ? initial.category.id : (categories.find((c) => c.slug === "other")?.id ?? "")
            }
            error={errors.customCategoryId}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          {!editing && (
            <button
              type="button"
              onClick={() => setMode("pick")}
              className="min-h-11 justify-self-start rounded-control px-0 text-link sm:col-span-2"
            >
              ← กลับไปเลือกจากคลังบริการ
            </button>
          )}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <MoneyField
          label="ราคาที่จ่ายจริง (บาท)"
          name="price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          hint={mode === "catalog" ? "เติมจากราคาในคลังแล้ว แก้ได้ถ้าได้ราคาโปรฯ" : undefined}
          error={errors.price}
        />
        <SelectField
          label="รอบบิล"
          name="billingCycle"
          value={cycle}
          onChange={(e) => setCycle(e.target.value as "monthly" | "yearly")}
          error={errors.billingCycle}
        >
          <option value="monthly">รายเดือน</option>
          <option value="yearly">รายปี</option>
        </SelectField>
        <TextField
          label="วันตัดเงินถัดไป"
          name="nextBillingDate"
          type="date"
          min={today}
          defaultValue={initial?.status === "active" ? initial.nextBillingDate : ""}
          hint="ระบบจะเลื่อนไปรอบถัดไปให้เองหลังถึงวันตัดเงิน"
          error={errors.nextBillingDate}
        />
      </div>

      <details
        className="group"
        open={Boolean(initial?.paymentMethod || initial?.trialEndsAt || initial?.note)}
      >
        <summary className="flex min-h-11 cursor-pointer items-center font-medium text-link">
          รายละเอียดเพิ่มเติม (ไม่บังคับ)
        </summary>
        <div className="mt-3 grid gap-5 sm:grid-cols-2">
          <TextField
            label="ช่องทางจ่าย"
            name="paymentMethod"
            defaultValue={initial?.paymentMethod ?? ""}
            placeholder="เช่น บัตร KBank, App Store"
            error={errors.paymentMethod}
          />
          <TextField
            label="วันหมดช่วงทดลองใช้ฟรี"
            name="trialEndsAt"
            type="date"
            defaultValue={initial?.trialEndsAt ?? ""}
            hint="ใส่ไว้แล้วจะได้อีเมลเตือนก่อนเริ่มเก็บเงิน"
            error={errors.trialEndsAt}
          />
          <TextField
            label="หมายเหตุ"
            name="note"
            defaultValue={initial?.note ?? ""}
            error={errors.note}
            className="sm:col-span-2"
          />
        </div>
      </details>

      {/* มือถือ: ปุ่มหลักติดล่างจอเหนือแถบเมนู (docs/03 ข้อ 6) */}
      <div className="sticky bottom-20 z-10 -mx-4 bg-night/85 px-4 py-3 backdrop-blur md:static md:mx-0 md:bg-transparent md:p-0">
        <Button type="submit" disabled={pending} className="w-full md:w-auto">
          {pending ? "กำลังบันทึก…" : editing ? "บันทึกการเปลี่ยนแปลง" : "เพิ่มรายการ"}
        </Button>
      </div>
    </form>
  );
}

/** ตัด source ออกและส่งเฉพาะช่องที่รายการชนิดนั้นแก้ได้ (PATCH) */
function withoutSource(body: Record<string, unknown>, isCustom: boolean) {
  const rest = { ...body };
  delete rest.source;
  if (isCustom) delete rest.planId;
  else {
    delete rest.customName;
    delete rest.customCategoryId;
  }
  if (!rest.planId) delete rest.planId;
  if (!rest.nextBillingDate) delete rest.nextBillingDate; // รายการที่ยกเลิกแล้วไม่ต้องมีวันตัดเงิน
  return rest;
}

/** แพ็กเกจของบริการเป็นตัวเลือกแบบ radio การ์ด — เห็นราคาและจำนวนคนก่อนเลือก */
function PlanChoices({
  service,
  planId,
  onChange,
}: {
  service: ServiceDetailDto;
  planId: number | undefined;
  onChange: (id: number) => void;
}) {
  return (
    <div role="radiogroup" aria-label="แพ็กเกจ" className="grid gap-2 sm:grid-cols-2">
      {service.plans.map((p) => {
        const checked = p.id === planId;
        return (
          <label
            key={p.id}
            className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-control border px-4 py-2 ${
              checked ? "border-paid bg-glass-strong" : "border-line hover:border-line-strong"
            }`}
          >
            <input
              type="radio"
              name="plan"
              value={p.id}
              checked={checked}
              onChange={() => onChange(p.id)}
              className="size-4 accent-paid"
            />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{p.name}</span>
              {p.maxMembers > 1 && (
                <span className="text-caption text-text-muted">ใช้ได้ {p.maxMembers} คน</span>
              )}
            </span>
            <span className="text-right">
              <span className="figure block">{formatBaht(p.price, { short: true })}</span>
              <span className="text-caption text-text-muted">{CYCLE[p.billingCycle]}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** ขั้นเลือกบริการ: ค้นหาในคลัง หรือไปเพิ่มเองถ้าไม่มี */
function ServicePicker({
  services,
  onPick,
  onCustom,
}: {
  services: ServiceDetailDto[];
  onPick: (s: ServiceDetailDto) => void;
  onCustom: () => void;
}) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? services.filter((s) => s.name.toLowerCase().includes(term)) : services;
  }, [q, services]);

  return (
    <div className="flex flex-col gap-4">
      <TextField
        label="ค้นหาบริการจากคลัง"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="เช่น Netflix"
        autoFocus
      />
      <button
        type="button"
        onClick={onCustom}
        className="min-h-11 self-start rounded-control font-medium text-link underline underline-offset-4"
      >
        ไม่มีในคลัง? เพิ่มเอง
      </button>
      {shown.length === 0 ? (
        <p className="text-text-muted">ไม่พบ &quot;{q}&quot; ในคลัง — กด เพิ่มเอง ด้านบนได้เลย</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="บริการในคลัง">
          {shown.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onPick(s)}
                className="flex min-h-14 w-full items-center gap-3 rounded-control border border-line px-3 py-2 text-left hover:border-line-strong hover:bg-glass"
              >
                <ServiceLogo name={s.name} logoUrl={s.logoUrl} size="sm" />
                <span className="flex-1 font-medium">{s.name}</span>
                <span className="text-caption text-text-muted">{s.category.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
