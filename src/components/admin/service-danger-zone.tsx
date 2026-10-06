"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";

/**
 * ลบบริการ — ถ้ามีผู้ใช้ผูกอยู่ API ตอบ 409 แล้ว dialog เปลี่ยนเป็นข้อเสนอให้ "ซ่อนบริการ" แทน (US-H2)
 */
export function ServiceDangerZone({ id, name, isActive }: { id: number; name: string; isActive: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [inUse, setInUse] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    const res = await apiFetch(`/api/admin/services/${id}`, { method: "DELETE" });
    setPending(false);
    if (res.ok) {
      toast(`ลบ ${name} แล้ว`);
      router.push("/admin/services");
      router.refresh();
    } else if (res.error.code === "IN_USE") {
      setInUse(res.error.message);
    } else {
      setOpen(false);
      toast(res.error.message, "error");
    }
  }

  async function hide() {
    setPending(true);
    const res = await apiFetch(`/api/admin/services/${id}`, { method: "PATCH", body: { isActive: false } });
    setPending(false);
    setOpen(false);
    if (!res.ok) return toast(res.error.message, "error");
    toast(`ซ่อน ${name} จากคลังบริการแล้ว`);
    router.refresh();
  }

  function close() {
    setOpen(false);
    setInUse(null);
  }

  return (
    <section aria-labelledby="danger-heading" className="mt-12 border-t border-line pt-6">
      <h2 id="danger-heading" className="text-lead font-semibold">
        ลบบริการ
      </h2>
      <p className="mt-1 text-text-muted">
        ลบได้เฉพาะบริการที่ยังไม่มีผู้ใช้คนไหนเพิ่มไว้ ถ้ามีแล้วให้ซ่อนแทน
      </p>
      <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>
        ลบ {name}
      </Button>

      <Dialog
        open={open}
        onClose={close}
        title={inUse ? `ลบ ${name} ไม่ได้` : `ลบ ${name} ออกจากคลัง?`}
        description={inUse ?? "แพ็กเกจและประวัติราคาทั้งหมดของบริการนี้จะถูกลบด้วย กู้คืนไม่ได้"}
      >
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={close} autoFocus>
            ยกเลิก
          </Button>
          {inUse ? (
            isActive && (
              <Button onClick={hide} disabled={pending}>
                ซ่อนบริการแทน
              </Button>
            )
          ) : (
            <Button className="bg-danger text-night" onClick={remove} disabled={pending}>
              ลบบริการ
            </Button>
          )}
        </div>
      </Dialog>
    </section>
  );
}
