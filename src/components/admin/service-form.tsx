"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { CheckboxField, SelectField, TextareaField } from "@/components/ui/fields";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { fieldErrors } from "@/lib/validation";
import { serviceCreateSchema } from "@/lib/validation/catalog";
import type { CategoryDto } from "@/server/services/catalog";

type Initial = {
  id: number;
  name: string;
  slug: string;
  categoryId: number;
  logoUrl: string | null;
  websiteUrl: string | null;
  cancelStepsText: string;
  isActive: boolean;
};

/** ฟอร์มเพิ่ม/แก้บริการ (US-H2) — สร้างเสร็จพาไปหน้าแก้ไขเพื่อเพิ่มแพ็กเกจต่อ */
export function ServiceForm({ categories, initial }: { categories: CategoryDto[]; initial?: Initial }) {
  const router = useRouter();
  const toast = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = serviceCreateSchema.safeParse({
      ...Object.fromEntries(form),
      isActive: form.get("isActive") === "on",
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setPending(true);
    const res = initial
      ? await apiFetch<{ id: number }>(`/api/admin/services/${initial.id}`, {
          method: "PATCH",
          body: parsed.data,
        })
      : await apiFetch<{ id: number }>("/api/admin/services", { method: "POST", body: parsed.data });
    setPending(false);
    if (!res.ok) {
      if (res.error.fields) setErrors(res.error.fields);
      else toast(res.error.message, "error");
      return;
    }
    if (initial) {
      toast(`บันทึก ${parsed.data.name} แล้ว`);
      router.refresh();
    } else {
      toast(`เพิ่ม ${parsed.data.name} แล้ว — เพิ่มแพ็กเกจต่อได้เลย`);
      router.push(`/admin/services/${res.data.id}`);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 md:grid-cols-2">
      <TextField label="ชื่อบริการ" name="name" defaultValue={initial?.name} error={errors.name} />
      <TextField
        label="slug (ใช้ใน URL /services/…)"
        name="slug"
        defaultValue={initial?.slug}
        hint="ตัวพิมพ์เล็ก a-z, 0-9 และขีดกลาง เช่น disney-plus"
        error={errors.slug}
      />
      <SelectField
        label="หมวด"
        name="categoryId"
        defaultValue={initial?.categoryId ?? ""}
        error={errors.categoryId}
      >
        <option value="" disabled>
          เลือกหมวด
        </option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <TextField
        label="เว็บไซต์"
        name="websiteUrl"
        type="url"
        inputMode="url"
        placeholder="https://"
        defaultValue={initial?.websiteUrl ?? ""}
        error={errors.websiteUrl}
      />
      <TextField
        label="ลิงก์รูปโลโก้ (ไม่บังคับ)"
        name="logoUrl"
        type="url"
        inputMode="url"
        placeholder="https://"
        defaultValue={initial?.logoUrl ?? ""}
        hint="ไม่ใส่จะแสดงตัวอักษรแรกของชื่อแทน"
        error={errors.logoUrl}
        className="md:col-span-2"
      />
      <TextareaField
        label="วิธียกเลิก"
        name="cancelSteps"
        defaultValue={initial?.cancelStepsText}
        hint="1 บรรทัด = 1 ขั้นตอน ผู้ใช้จะเห็นเป็นรายการลำดับเลข"
        error={errors.cancelSteps}
        rows={6}
        className="md:col-span-2"
      />
      <div className="md:col-span-2">
        <CheckboxField
          label="แสดงในคลังบริการ"
          description="ปิดเพื่อซ่อนจากผู้ใช้ — รายการที่ผู้ใช้เพิ่มไว้แล้วยังอยู่ครบ"
          name="isActive"
          defaultChecked={initial?.isActive ?? true}
        />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>
          {initial ? "บันทึกการเปลี่ยนแปลง" : "เพิ่มบริการ"}
        </Button>
      </div>
    </form>
  );
}
