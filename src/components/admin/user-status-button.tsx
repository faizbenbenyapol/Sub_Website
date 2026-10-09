"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";

/** ปุ่มระงับ/เปิดใช้งานบัญชี (US-H4) พร้อม dialog ยืนยันที่บอกผลที่จะเกิดขึ้น */
export function UserStatusButton({
  id,
  name,
  status,
}: {
  id: number;
  name: string;
  status: "active" | "suspended";
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const suspending = status === "active";

  /** ยืนยันระงับ/เปิดใช้งานบัญชี แล้วโหลดตารางใหม่ */
  async function confirm() {
    setPending(true);
    const res = await apiFetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: { status: suspending ? "suspended" : "active" },
    });
    setPending(false);
    setOpen(false);
    if (!res.ok) return toast(res.error.message, "error");
    toast(suspending ? `ระงับบัญชี ${name} แล้ว` : `เปิดใช้งานบัญชี ${name} แล้ว`);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`min-h-11 rounded-control px-3 hover:bg-glass-strong ${suspending ? "text-danger" : "text-link"}`}
      >
        {suspending ? "ระงับ" : "เปิดใช้งาน"}
        <span className="sr-only"> {name}</span>
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={suspending ? `ระงับบัญชี ${name}?` : `เปิดใช้งานบัญชี ${name}?`}
        description={
          suspending
            ? "ผู้ใช้จะเข้าสู่ระบบไม่ได้ทันที และหยุดได้รับอีเมลแจ้งเตือน ข้อมูลยังอยู่ครบ เปิดใช้งานคืนได้ทุกเมื่อ"
            : "ผู้ใช้จะเข้าสู่ระบบและได้รับอีเมลแจ้งเตือนได้ตามปกติ"
        }
      >
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)} autoFocus>
            ยกเลิก
          </Button>
          <Button className={suspending ? "bg-danger text-night" : ""} onClick={confirm} disabled={pending}>
            {suspending ? "ระงับบัญชี" : "เปิดใช้งาน"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
