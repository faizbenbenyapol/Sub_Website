"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { fieldErrors } from "@/lib/validation";
import { categoryCreateSchema } from "@/lib/validation/catalog";
import type { AdminCategoryDto } from "@/server/services/admin-catalog";

type Editing = { mode: "create" } | { mode: "edit"; category: AdminCategoryDto } | null;

/** ตารางหมวด + dialog เพิ่ม/แก้/ลบ (US-H1) */
export function CategoryManager({ categories }: { categories: AdminCategoryDto[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<AdminCategoryDto | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function openForm(next: Editing) {
    setErrors({});
    setEditing(next);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const parsed = categoryCreateSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setPending(true);
    const res =
      editing.mode === "create"
        ? await apiFetch("/api/admin/categories", { method: "POST", body: parsed.data })
        : await apiFetch(`/api/admin/categories/${editing.category.id}`, {
            method: "PATCH",
            body: parsed.data,
          });
    setPending(false);
    if (!res.ok) {
      if (res.error.fields) setErrors(res.error.fields);
      else toast(res.error.message, "error");
      return;
    }
    toast(
      editing.mode === "create"
        ? `เพิ่มหมวด ${parsed.data.name} แล้ว`
        : `บันทึกหมวด ${parsed.data.name} แล้ว`,
    );
    setEditing(null);
    router.refresh();
  }

  async function remove() {
    if (!deleting) return;
    setPending(true);
    const res = await apiFetch(`/api/admin/categories/${deleting.id}`, { method: "DELETE" });
    setPending(false);
    setDeleting(null);
    if (!res.ok) return toast(res.error.message, "error");
    toast(`ลบหมวด ${deleting.name} แล้ว`);
    router.refresh();
  }

  const current = editing?.mode === "edit" ? editing.category : undefined;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h2 font-bold">หมวดหมู่</h1>
          <p className="mt-1 text-text-muted">หมวดที่ใช้จัดกลุ่มบริการและกราฟสัดส่วนค่าใช้จ่ายของผู้ใช้</p>
        </div>
        <Button onClick={() => openForm({ mode: "create" })}>เพิ่มหมวด</Button>
      </div>

      <div className="glass mt-6 overflow-x-auto rounded-card">
        <table className="w-full min-w-[520px] text-left">
          <thead className="text-caption text-text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="px-5 py-3 font-medium">
                ลำดับ
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                ชื่อหมวด
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                slug
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
                บริการ
              </th>
              <th scope="col" className="px-5 py-3">
                <span className="sr-only">จัดการ</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="figure px-5 py-3 text-text-muted">{c.sortOrder}</td>
                <td className="px-5 py-3 font-medium">{c.name}</td>
                <td className="px-5 py-3 font-mono text-caption text-text-muted">{c.slug}</td>
                <td className="figure px-5 py-3 text-right">{c.serviceCount}</td>
                <td className="px-5 py-2 text-right whitespace-nowrap">
                  <button
                    onClick={() => openForm({ mode: "edit", category: c })}
                    className="min-h-11 rounded-control px-3 text-link hover:bg-glass-strong"
                  >
                    แก้ไข<span className="sr-only"> {c.name}</span>
                  </button>
                  <button
                    onClick={() => setDeleting(c)}
                    className="min-h-11 rounded-control px-3 text-danger hover:bg-glass-strong"
                  >
                    ลบ<span className="sr-only"> {c.name}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {categories.length === 0 && (
          <p className="px-5 py-8 text-text-muted">ยังไม่มีหมวด — เพิ่มหมวดแรกก่อนเพิ่มบริการ</p>
        )}
      </div>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={current ? `แก้หมวด ${current.name}` : "เพิ่มหมวด"}
      >
        <form onSubmit={save} noValidate className="flex flex-col gap-4" key={current?.id ?? "new"}>
          <TextField label="ชื่อหมวด" name="name" defaultValue={current?.name} error={errors.name} />
          <TextField
            label="slug (ใช้ใน URL)"
            name="slug"
            defaultValue={current?.slug}
            hint="ตัวพิมพ์เล็ก a-z, 0-9 และขีดกลาง เช่น video"
            error={errors.slug}
          />
          <TextField
            label="ลำดับการแสดง"
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={current?.sortOrder ?? categories.length}
            error={errors.sortOrder}
          />
          <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={pending}>
              {current ? "บันทึกการเปลี่ยนแปลง" : "เพิ่มหมวด"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`ลบหมวด ${deleting?.name ?? ""}?`}
        description={
          deleting && deleting.serviceCount > 0
            ? `หมวดนี้มีบริการ ${deleting.serviceCount} รายการ ต้องย้ายบริการไปหมวดอื่นก่อนจึงจะลบได้`
            : "ลบแล้วกู้คืนไม่ได้"
        }
      >
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setDeleting(null)} autoFocus>
            ยกเลิก
          </Button>
          <Button
            className="bg-danger text-night"
            onClick={remove}
            disabled={pending || (deleting?.serviceCount ?? 0) > 0}
          >
            ลบหมวด
          </Button>
        </div>
      </Dialog>
    </>
  );
}
