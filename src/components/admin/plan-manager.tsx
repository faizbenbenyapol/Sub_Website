"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { CheckboxField, MoneyField, SelectField } from "@/components/ui/fields";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { formatBaht } from "@/lib/money";
import { fieldErrors } from "@/lib/validation";
import { planCreateSchema } from "@/lib/validation/catalog";
import type { PlanDto } from "@/server/services/catalog";

type Editing = { mode: "create" } | { mode: "edit"; plan: PlanDto } | null;
const CYCLE = { monthly: "รายเดือน", yearly: "รายปี" } as const;

/** ตารางแพ็กเกจของบริการ + dialog เพิ่ม/แก้/ซ่อน/ลบ (US-H3) */
export function PlanManager({ serviceId, plans }: { serviceId: number; plans: PlanDto[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<PlanDto | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const current = editing?.mode === "edit" ? editing.plan : undefined;

  /** ส่งคำขอแล้วแสดงผลเป็น toast — คืน true ถ้าสำเร็จ */
  async function send(path: string, method: string, body: unknown, success: string) {
    setPending(true);
    const res = await apiFetch(path, { method, body });
    setPending(false);
    if (!res.ok) {
      if (res.error.fields) setErrors(res.error.fields);
      else toast(res.error.message, "error");
      return false;
    }
    toast(success);
    router.refresh();
    return true;
  }

  /** บันทึกแพ็กเกจ (เพิ่มหรือแก้ราคา — แก้ราคาแล้วระบบเก็บประวัติให้เอง) */
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = planCreateSchema.safeParse({
      ...Object.fromEntries(form),
      price: String(form.get("price") ?? "").replace(/,/g, ""),
      isActive: form.get("isActive") === "on",
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    const ok = current
      ? await send(
          `/api/admin/plans/${current.id}`,
          "PATCH",
          parsed.data,
          `บันทึกแพ็กเกจ ${parsed.data.name} แล้ว`,
        )
      : await send(
          `/api/admin/services/${serviceId}/plans`,
          "POST",
          parsed.data,
          `เพิ่มแพ็กเกจ ${parsed.data.name} แล้ว`,
        );
    if (ok) setEditing(null);
  }

  /** สลับแสดง/ซ่อนแพ็กเกจจากผู้ใช้ */
  async function toggleActive(plan: PlanDto) {
    await send(
      `/api/admin/plans/${plan.id}`,
      "PATCH",
      { isActive: !plan.isActive },
      plan.isActive ? `ซ่อนแพ็กเกจ ${plan.name} แล้ว` : `แสดงแพ็กเกจ ${plan.name} แล้ว`,
    );
  }

  /** ลบแพ็กเกจ — ถ้ามีผู้ใช้ผูกอยู่ server ตอบ 409 แนะนำให้ซ่อนแทน */
  async function remove() {
    if (!deleting) return;
    const plan = deleting;
    setDeleting(null);
    await send(`/api/admin/plans/${plan.id}`, "DELETE", undefined, `ลบแพ็กเกจ ${plan.name} แล้ว`);
  }

  return (
    <section aria-labelledby="plans-heading" className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="plans-heading" className="text-h3 font-bold">
          แพ็กเกจ
        </h2>
        <Button
          variant="secondary"
          onClick={() => {
            setErrors({});
            setEditing({ mode: "create" });
          }}
        >
          เพิ่มแพ็กเกจ
        </Button>
      </div>

      <div className="glass relative mt-4 overflow-x-auto rounded-card">
        <table className="stack-table w-full min-w-[600px] text-left">
          <thead className="text-caption text-text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="px-5 py-3 font-medium">
                ชื่อแพ็กเกจ
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
                ราคา
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                รอบบิล
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
                ใช้ได้
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                สถานะ
              </th>
              <th scope="col" className="px-5 py-3">
                <span className="sr-only">จัดการ</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr
                key={p.id}
                className={`border-b border-line last:border-0 ${p.isActive ? "" : "text-text-muted"}`}
              >
                <td className="px-5 py-3 font-medium">{p.name}</td>
                <td data-label="ราคา" className="figure px-5 py-3 text-right">
                  {formatBaht(p.price)}
                </td>
                <td data-label="รอบบิล" className="px-5 py-3">
                  {CYCLE[p.billingCycle]}
                </td>
                <td data-label="ใช้ได้" className="figure px-5 py-3 text-right">
                  {p.maxMembers}
                  <span className="font-sans text-caption text-text-muted"> คน</span>
                </td>
                <td data-label="สถานะ" className="px-5 py-3 text-caption">
                  {p.isActive ? "แสดงอยู่" : "ซ่อนอยู่"}
                </td>
                <td className="px-5 py-2 text-right whitespace-nowrap">
                  <button
                    onClick={() => {
                      setErrors({});
                      setEditing({ mode: "edit", plan: p });
                    }}
                    className="min-h-11 rounded-control px-3 text-link hover:bg-glass-strong"
                  >
                    แก้ไข<span className="sr-only"> {p.name}</span>
                  </button>
                  <button
                    onClick={() => toggleActive(p)}
                    disabled={pending}
                    className="min-h-11 rounded-control px-3 text-text-muted hover:bg-glass-strong hover:text-text"
                  >
                    {p.isActive ? "ซ่อน" : "แสดง"}
                    <span className="sr-only"> {p.name}</span>
                  </button>
                  <button
                    onClick={() => setDeleting(p)}
                    className="min-h-11 rounded-control px-3 text-danger hover:bg-glass-strong"
                  >
                    ลบ<span className="sr-only"> {p.name}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {plans.length === 0 && (
          <p className="px-5 py-8 text-text-muted">
            ยังไม่มีแพ็กเกจ — ผู้ใช้จะเพิ่มบริการนี้จากรวมบริการไม่ได้จนกว่าจะมีอย่างน้อย 1 แพ็กเกจ
          </p>
        )}
      </div>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={current ? `แก้แพ็กเกจ ${current.name}` : "เพิ่มแพ็กเกจ"}
        description={current ? "ถ้าเปลี่ยนราคา ราคาเดิมจะถูกเก็บในประวัติราคาให้อัตโนมัติ" : undefined}
      >
        <form onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2" key={current?.id ?? "new"}>
          <TextField
            label="ชื่อแพ็กเกจ"
            name="name"
            defaultValue={current?.name}
            error={errors.name}
            className="sm:col-span-2"
          />
          <MoneyField
            label="ราคา (บาท)"
            name="price"
            defaultValue={current ? current.price.toFixed(2) : ""}
            hint={current ? `ราคาปัจจุบัน ${formatBaht(current.price)}` : undefined}
            error={errors.price}
          />
          <SelectField
            label="รอบบิล"
            name="billingCycle"
            defaultValue={current?.billingCycle ?? "monthly"}
            error={errors.billingCycle}
          >
            <option value="monthly">รายเดือน</option>
            <option value="yearly">รายปี</option>
          </SelectField>
          <TextField
            label="ใช้ได้สูงสุด (คน)"
            name="maxMembers"
            type="number"
            min={1}
            max={20}
            defaultValue={current?.maxMembers ?? 1}
            hint="มากกว่า 1 = Family plan ที่หารกับเพื่อนได้"
            error={errors.maxMembers}
            className="sm:col-span-2"
          />
          <div className="sm:col-span-2">
            <CheckboxField
              label="แสดงให้ผู้ใช้เลือก"
              name="isActive"
              defaultChecked={current?.isActive ?? true}
            />
          </div>
          <div className="mt-2 flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={pending}>
              {current ? "บันทึกการเปลี่ยนแปลง" : "เพิ่มแพ็กเกจ"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`ลบแพ็กเกจ ${deleting?.name ?? ""}?`}
        description="ถ้ามีผู้ใช้เลือกแพ็กเกจนี้อยู่ ระบบจะไม่ให้ลบ — ใช้ปุ่ม ซ่อน แทน ประวัติราคาของแพ็กเกจนี้จะถูกลบด้วย"
      >
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setDeleting(null)} autoFocus>
            ยกเลิก
          </Button>
          <Button className="bg-danger text-night" onClick={remove} disabled={pending}>
            ลบแพ็กเกจ
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
