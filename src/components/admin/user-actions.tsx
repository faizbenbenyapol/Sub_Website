"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";

/** ปุ่มเปลี่ยนสิทธิ์ ผู้ใช้ทั่วไป ↔ ผู้ดูแลระบบ พร้อม dialog บอกผลที่จะเกิดขึ้น */
export function UserRoleButton({ id, name, role }: { id: number; name: string; role: "user" | "admin" }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const promoting = role === "user";

  /** ยืนยันใน dialog แล้วส่งคำขอไป server */
  async function confirm() {
    setPending(true);
    const res = await apiFetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: { role: promoting ? "admin" : "user" },
    });
    setPending(false);
    setOpen(false);
    if (!res.ok) return toast(res.error.message, "error");
    toast(promoting ? `ตั้ง ${name} เป็นผู้ดูแลระบบแล้ว` : `เปลี่ยน ${name} เป็นผู้ใช้ทั่วไปแล้ว`);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-control px-3 text-link hover:bg-glass-strong"
      >
        {promoting ? "ตั้งเป็นผู้ดูแล" : "ถอดสิทธิ์ผู้ดูแล"}
        <span className="sr-only"> {name}</span>
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={promoting ? `ตั้ง ${name} เป็นผู้ดูแลระบบ?` : `เปลี่ยน ${name} เป็นผู้ใช้ทั่วไป?`}
        description={
          promoting
            ? "จะเข้าหลังบ้านได้ทั้งหมด: แก้รวมบริการ เห็นอีเมลผู้ใช้ทุกคน ระงับ/ลบบัญชีได้ — คนนั้นต้องเข้าสู่ระบบใหม่หนึ่งครั้ง"
            : "จะเข้าหลังบ้านไม่ได้อีก ข้อมูลส่วนตัวของคนนั้นยังอยู่ครบ — คนนั้นต้องเข้าสู่ระบบใหม่หนึ่งครั้ง"
        }
      >
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)} autoFocus>
            ยกเลิก
          </Button>
          <Button onClick={confirm} disabled={pending}>
            {promoting ? "ตั้งเป็นผู้ดูแลระบบ" : "เปลี่ยนเป็นผู้ใช้ทั่วไป"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

/** ปุ่มลบบัญชีถาวร — ต้องพิมพ์อีเมลของบัญชีนั้นให้ตรงก่อนจึงกดลบได้ (กันลบผิดคน) */
export function UserDeleteButton({ id, name, email }: { id: number; name: string; email: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  /** ยืนยันใน dialog แล้วส่งคำขอไป server */
  async function confirm() {
    setPending(true);
    const res = await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" });
    setPending(false);
    if (!res.ok) return toast(res.error.message, "error");
    setOpen(false);
    toast(`ลบบัญชี ${name} แล้ว`);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => {
          setTyped("");
          setOpen(true);
        }}
        className="min-h-11 rounded-control px-3 text-danger hover:bg-glass-strong"
      >
        ลบ<span className="sr-only"> {name}</span>
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`ลบบัญชี ${name} ถาวร?`}
        description="รายการ subscription กลุ่มหารค่าบริการ การแจ้งเตือน และข้อความแจ้งปัญหาของบัญชีนี้จะถูกลบทั้งหมด กู้คืนไม่ได้ ถ้าแค่ไม่ให้ใช้งานชั่วคราว ให้กด ระงับ แทน"
      >
        <label htmlFor={`confirm-${id}`} className="text-caption font-medium">
          พิมพ์ <span className="font-mono text-text">{email}</span> เพื่อยืนยัน
        </label>
        <input
          id={`confirm-${id}`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="mt-1.5 h-12 w-full rounded-control border border-line-strong bg-glass-strong px-4 focus:border-paid focus:outline-none"
        />
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)} autoFocus>
            ยกเลิก
          </Button>
          <Button className="bg-danger text-night" onClick={confirm} disabled={!matches || pending}>
            ลบบัญชีถาวร
          </Button>
        </div>
      </Dialog>
    </>
  );
}
