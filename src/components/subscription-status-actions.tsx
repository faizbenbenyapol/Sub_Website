"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DateField } from "@/components/ui/date-field";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";

type Props = {
  id: number;
  name: string;
  status: "active" | "cancelled";
  hasGroup: boolean;
  today: string;
};

/**
 * ยกเลิก / กลับมาใช้ / ลบรายการ (US-C2)
 * ยกเลิก = เก็บประวัติไว้ในแท็บยกเลิกแล้ว · ลบ = เอาออกจากระบบ (ต้องยืนยันทั้งคู่)
 */
export function SubscriptionStatusActions({ id, name, status, hasGroup, today }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState<"cancel" | "reactivate" | "delete" | null>(null);
  const [dateError, setDateError] = useState<string>();
  const [pending, setPending] = useState(false);

  /** ส่งคำขอ แล้วพากลับหน้ารายการพร้อม toast ที่ใช้คำเดียวกับปุ่ม */
  async function run(method: string, body: unknown, success: string, tab: string) {
    setPending(true);
    const res = await apiFetch(`/api/subscriptions/${id}`, { method, body });
    setPending(false);
    if (!res.ok) {
      if (res.error.fields?.nextBillingDate) return setDateError(res.error.fields.nextBillingDate);
      setOpen(null);
      return toast(res.error.message, "error");
    }
    setOpen(null);
    toast(success);
    router.push(tab);
    router.refresh();
  }

  /** กลับมาใช้รายการที่ยกเลิกไว้ ต้องเลือกวันตัดเงินถัดไปก่อน */
  function reactivate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const date = String(new FormData(e.currentTarget).get("nextBillingDate") ?? "");
    if (!date) return setDateError("กรุณาเลือกวันตัดเงินถัดไป");
    run(
      "PATCH",
      { status: "active", nextBillingDate: date },
      `${name} กลับมาอยู่ในรายการที่ใช้งานแล้ว`,
      "/subscriptions",
    );
  }

  return (
    <section aria-labelledby="status-heading" className="mt-12 border-t border-line pt-6">
      <h2 id="status-heading" className="text-lead font-semibold">
        {status === "active" ? "เลิกใช้บริการนี้" : "รายการนี้ยกเลิกแล้ว"}
      </h2>
      <p className="mt-1 text-text-muted">
        {status === "active"
          ? "ยกเลิกแล้วระบบหยุดเตือนและไม่นับในยอดรวม แต่ยังเก็บไว้ในแท็บยกเลิกแล้ว"
          : "กลับมาใช้ได้ถ้าสมัครบริการนี้ใหม่ หรือลบออกถ้าไม่ต้องการเก็บไว้"}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {status === "active" ? (
          <Button variant="secondary" onClick={() => setOpen("cancel")}>
            ยกเลิกรายการ
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              setDateError(undefined);
              setOpen("reactivate");
            }}
          >
            กลับมาใช้
          </Button>
        )}
        <Button variant="danger" onClick={() => setOpen("delete")}>
          ลบรายการ
        </Button>
      </div>

      <Dialog
        open={open === "cancel"}
        onClose={() => setOpen(null)}
        title={`ยกเลิก ${name}?`}
        description="รายการจะย้ายไปแท็บยกเลิกแล้ว ระบบหยุดส่งอีเมลเตือน — อย่าลืมไปยกเลิกที่ตัวบริการด้วย ไม่งั้นยังโดนตัดเงิน"
      >
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setOpen(null)} autoFocus>
            ไม่ยกเลิก
          </Button>
          <Button
            onClick={() =>
              run("PATCH", { status: "cancelled" }, `ยกเลิก ${name} แล้ว`, "/subscriptions?status=cancelled")
            }
            disabled={pending}
          >
            ยกเลิกรายการ
          </Button>
        </div>
      </Dialog>

      <Dialog open={open === "reactivate"} onClose={() => setOpen(null)} title={`กลับมาใช้ ${name}`}>
        <form onSubmit={reactivate} noValidate className="flex flex-col gap-4">
          <DateField label="วันตัดเงินถัดไป" name="nextBillingDate" min={today} error={dateError} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpen(null)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={pending}>
              กลับมาใช้
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={open === "delete"}
        onClose={() => setOpen(null)}
        title={`ลบ ${name} ออกจากรายการ?`}
        description={
          hasGroup
            ? "กลุ่มหารค่าบริการที่ผูกกับรายการนี้และลิงก์จ่ายเงินของเพื่อนจะถูกลบด้วย กู้คืนไม่ได้"
            : "ลบแล้วกู้คืนไม่ได้ ถ้าแค่เลิกใช้ ให้กด ยกเลิกรายการ แทนเพื่อเก็บประวัติไว้"
        }
      >
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setOpen(null)} autoFocus>
            ไม่ลบ
          </Button>
          <Button
            className="bg-danger text-night"
            onClick={() => run("DELETE", undefined, `ลบ ${name} แล้ว`, "/subscriptions")}
            disabled={pending}
          >
            ลบรายการ
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
