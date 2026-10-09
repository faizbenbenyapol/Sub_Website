"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { MoneyField } from "@/components/ui/fields";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { formatThaiMonth } from "@/lib/dates";
import { formatBaht } from "@/lib/money";
import { fieldErrors } from "@/lib/validation";
import { groupUpdateSchema, memberSchema } from "@/lib/validation/group";
import type { GroupDetailDto, GroupMemberDto } from "@/server/services/groups";

type Props = { group: GroupDetailDto; prevPeriod: string; nextPeriod: string | null; isCurrent: boolean };

/** หน้าจัดการกลุ่มของเจ้าของ (US-F2, F3): สถานะรายเดือน · ลิงก์จ่ายเงิน · เตือน · แก้สมาชิก · ตั้งค่า · ลบ */
export function GroupManager({ group, prevPeriod, nextPeriod, isCurrent }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [dialog, setDialog] = useState<
    "add" | "settings" | "delete" | { edit: GroupMemberDto } | { remove: GroupMemberDto } | null
  >(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const custom = group.splitMode === "custom";

  /** ส่งคำขอแล้วแสดงผล — คืน true ถ้าสำเร็จ */
  async function send(path: string, method: string, body: unknown, success: string) {
    setPending(true);
    const res = await apiFetch(path, { method, body });
    setPending(false);
    if (!res.ok) {
      if (res.error.fields) setErrors(res.error.fields);
      toast(res.error.message, "error");
      return false;
    }
    toast(success);
    router.refresh();
    return true;
  }

  /** สลับจ่ายแล้ว/ยังไม่จ่ายของสมาชิกในเดือนที่ดูอยู่ */
  const togglePaid = (m: GroupMemberDto) =>
    send(
      `/api/groups/${group.id}/payments`,
      "PUT",
      { memberId: m.id, period: group.period, status: m.status === "paid" ? "unpaid" : "paid" },
      m.status === "paid" ? `${m.name} กลับเป็นยังไม่จ่าย` : `${m.name} จ่ายแล้ว`,
    );

  /** คัดลอกลิงก์หน้าจ่ายเงินของสมาชิกไปคลิปบอร์ด */
  async function copyLink(m: GroupMemberDto) {
    try {
      await navigator.clipboard.writeText(m.payUrl);
      toast(`คัดลอกลิงก์จ่ายเงินของ ${m.name} แล้ว`);
    } catch {
      toast("คัดลอกไม่สำเร็จ — กดค้างที่ปุ่ม เปิดหน้าจ่าย แล้วคัดลอกลิงก์แทน", "error");
    }
  }

  /** เพิ่มหรือแก้สมาชิก (member ไม่มี = เพิ่มใหม่) */
  async function saveMember(e: FormEvent<HTMLFormElement>, member?: GroupMemberDto) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = (member ? memberSchema.partial() : memberSchema).safeParse({
      ...raw,
      amount: custom ? raw.amount : undefined,
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    const ok = member
      ? await send(
          `/api/groups/${group.id}/members/${member.id}`,
          "PATCH",
          parsed.data,
          `บันทึก ${parsed.data.name ?? member.name} แล้ว`,
        )
      : await send(`/api/groups/${group.id}/members`, "POST", parsed.data, `เพิ่ม ${parsed.data.name} แล้ว`);
    if (ok) setDialog(null);
  }

  /** บันทึกชื่อกลุ่ม พร้อมเพย์ และวิธีหาร */
  async function saveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const parsed = groupUpdateSchema.safeParse({
      name: raw.name,
      splitMode: raw.splitMode,
      ...(raw.promptpayId && { promptpayId: raw.promptpayId }),
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    if (await send(`/api/groups/${group.id}`, "PATCH", parsed.data, "บันทึกการตั้งค่ากลุ่มแล้ว"))
      setDialog(null);
  }

  /** ลบกลุ่ม (ลิงก์จ่ายเงินของทุกคนใช้ไม่ได้ทันที รายการ subscription ยังอยู่) */
  async function removeGroup() {
    setPending(true);
    const res = await apiFetch(`/api/groups/${group.id}`, { method: "DELETE" });
    setPending(false);
    if (!res.ok) return toast(res.error.message, "error");
    toast(`ลบ${group.name}แล้ว`);
    router.push("/groups");
    router.refresh();
  }

  /** เปิด dialog (เพิ่ม/แก้สมาชิก ตั้งค่ากลุ่ม ลบ) พร้อมล้าง error เดิม */
  const open = (d: typeof dialog) => {
    setErrors({});
    setDialog(d);
  };
  const editing = dialog && typeof dialog === "object" && "edit" in dialog ? dialog.edit : undefined;
  const removing = dialog && typeof dialog === "object" && "remove" in dialog ? dialog.remove : undefined;

  return (
    <>
      <dl className="mt-5 grid grid-cols-3 gap-4 border-b border-line pb-6">
        <div>
          <dt className="text-caption text-text-muted">ราคาต่อเดือน</dt>
          <dd className="figure text-lead">{formatBaht(group.total)}</dd>
        </div>
        <div>
          <dt className="text-caption text-text-muted">ส่วนของคุณ</dt>
          <dd className="figure text-lead">{formatBaht(group.ownerAmount)}</dd>
        </div>
        <div>
          <dt className="text-caption text-text-muted">รับเงินที่</dt>
          <dd className="figure text-lead">{group.promptpayIdMasked}</dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h3 font-bold">เดือน{formatThaiMonth(group.period)}</h2>
        <nav aria-label="เลือกเดือน" className="flex items-center gap-1">
          <Link
            href={`?period=${prevPeriod}`}
            aria-label="เดือนก่อนหน้า"
            className="flex size-11 items-center justify-center rounded-control border border-line hover:bg-glass-strong"
          >
            ‹
          </Link>
          {!isCurrent && (
            <Link href="?" className="flex min-h-11 items-center rounded-control px-3 hover:bg-glass-strong">
              เดือนนี้
            </Link>
          )}
          {nextPeriod && (
            <Link
              href={`?period=${nextPeriod}`}
              aria-label="เดือนถัดไป"
              className="flex size-11 items-center justify-center rounded-control border border-line hover:bg-glass-strong"
            >
              ›
            </Link>
          )}
        </nav>
      </div>

      <ul className="glass mt-4 rounded-card">
        {group.members.map((m) => (
          <li
            key={m.id}
            className="flex flex-col gap-3 border-b border-line px-4 py-4 last:border-0 md:flex-row md:items-center md:px-5"
          >
            <div className="min-w-0 flex-1">
              <p className="font-display text-lead font-semibold">{m.name}</p>
              <p className="text-caption [overflow-wrap:anywhere] text-text-muted">
                {m.email ?? "ไม่มีอีเมล"}
              </p>
            </div>
            <p className="figure text-lead md:w-28 md:text-right">{formatBaht(m.amount)}</p>
            <button
              onClick={() => togglePaid(m)}
              disabled={pending}
              aria-pressed={m.status === "paid"}
              className={`flex min-h-11 items-center gap-2 rounded-control border px-4 md:w-36 ${
                m.status === "paid" ? "border-paid bg-glass-strong" : "border-line-strong"
              }`}
            >
              <span
                aria-hidden
                className={`size-2.5 rounded-full ${m.status === "paid" ? "bg-paid" : "bg-text-faint"}`}
              />
              {m.status === "paid" ? "จ่ายแล้ว" : "ยังไม่จ่าย"}
              <span className="sr-only"> {m.name} — กดเพื่อเปลี่ยน</span>
            </button>
            {/* กว้างคงที่บนจอใหญ่ ให้คอลัมน์ยอด/สถานะตรงกันทุกแถว แม้บางแถวมีปุ่มเตือนเพิ่ม */}
            <div className="flex flex-wrap gap-1 lg:w-[28rem] lg:justify-end">
              <button
                onClick={() => copyLink(m)}
                className="min-h-11 rounded-control px-3 text-link hover:bg-glass-strong"
              >
                คัดลอกลิงก์<span className="sr-only">จ่ายเงินของ {m.name}</span>
              </button>
              <a
                href={m.payUrl}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center rounded-control px-3 text-link hover:bg-glass-strong"
              >
                เปิดหน้าจ่าย<span className="sr-only"> ของ {m.name} (แท็บใหม่)</span>
              </a>
              {isCurrent && m.status === "unpaid" && m.email && (
                <button
                  onClick={() =>
                    send(
                      `/api/groups/${group.id}/members/${m.id}/remind`,
                      "POST",
                      undefined,
                      `ส่งอีเมลเตือน ${m.name} แล้ว`,
                    )
                  }
                  disabled={pending}
                  className="min-h-11 rounded-control px-3 text-link hover:bg-glass-strong"
                >
                  เตือนทางอีเมล
                </button>
              )}
              <button
                onClick={() => open({ edit: m })}
                className="min-h-11 rounded-control px-3 text-text-muted hover:bg-glass-strong hover:text-text"
              >
                แก้ไข<span className="sr-only"> {m.name}</span>
              </button>
              <button
                onClick={() => open({ remove: m })}
                className="min-h-11 rounded-control px-3 text-danger hover:bg-glass-strong"
              >
                ลบ<span className="sr-only"> {m.name}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-3">
        {group.members.length < 10 && (
          <Button variant="secondary" onClick={() => open("add")}>
            เพิ่มสมาชิก
          </Button>
        )}
        <Button variant="secondary" onClick={() => open("settings")}>
          ตั้งค่ากลุ่ม
        </Button>
      </div>

      <section className="mt-12 border-t border-line pt-6">
        <h2 className="text-lead font-semibold">ลบกลุ่มนี้</h2>
        <p className="mt-1 text-text-muted">
          ลิงก์จ่ายเงินของเพื่อนทุกคนจะใช้ไม่ได้ทันที รายการ subscription ยังอยู่
        </p>
        <Button variant="danger" className="mt-4" onClick={() => open("delete")}>
          ลบกลุ่ม
        </Button>
      </section>

      <Dialog
        open={dialog === "add" || editing !== undefined}
        onClose={() => setDialog(null)}
        title={editing ? `แก้ ${editing.name}` : "เพิ่มสมาชิก"}
      >
        <form
          onSubmit={(e) => saveMember(e, editing)}
          noValidate
          className="flex flex-col gap-4"
          key={editing?.id ?? "new"}
        >
          <TextField label="ชื่อ" name="name" defaultValue={editing?.name} error={errors.name} />
          <TextField
            label="อีเมล (ไม่บังคับ)"
            name="email"
            type="email"
            defaultValue={editing?.email ?? ""}
            error={errors.email}
          />
          {custom ? (
            <MoneyField
              label="ยอด (บาท)"
              name="amount"
              defaultValue={editing?.amount.toFixed(2) ?? ""}
              error={errors.amount}
            />
          ) : (
            <p className="text-caption text-text-muted">โหมดหารเท่ากัน ระบบคำนวณยอดใหม่ให้ทุกคนอัตโนมัติ</p>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setDialog(null)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={pending}>
              {editing ? "บันทึก" : "เพิ่มสมาชิก"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={dialog === "settings"} onClose={() => setDialog(null)} title="ตั้งค่ากลุ่ม">
        <form onSubmit={saveSettings} noValidate className="flex flex-col gap-4">
          <TextField label="ชื่อกลุ่ม" name="name" defaultValue={group.name} error={errors.name} />
          <TextField
            label="PromptPay ID ใหม่ (เว้นว่างถ้าไม่เปลี่ยน)"
            name="promptpayId"
            inputMode="numeric"
            placeholder={group.promptpayIdMasked}
            error={errors.promptpayId}
          />
          <fieldset>
            <legend className="text-caption font-medium">วิธีหาร</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["equal", "หารเท่ากัน"],
                  ["custom", "กำหนดยอดเอง"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line px-4 has-[:checked]:border-paid"
                >
                  <input
                    type="radio"
                    name="splitMode"
                    value={value}
                    defaultChecked={group.splitMode === value}
                    className="size-4 accent-paid"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setDialog(null)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={pending}>
              บันทึกการตั้งค่า
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={removing !== undefined}
        onClose={() => setDialog(null)}
        title={`ลบ ${removing?.name ?? ""} ออกจากกลุ่ม?`}
        description={`ลิงก์จ่ายเงินของ ${removing?.name ?? ""} จะใช้ไม่ได้ทันที${custom ? "" : " และระบบจะหารยอดใหม่ให้คนที่เหลือ"}`}
      >
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setDialog(null)} autoFocus>
            ไม่ลบ
          </Button>
          <Button
            className="bg-danger text-night"
            disabled={pending}
            onClick={async () => {
              if (
                removing &&
                (await send(
                  `/api/groups/${group.id}/members/${removing.id}`,
                  "DELETE",
                  undefined,
                  `ลบ ${removing.name} แล้ว`,
                ))
              )
                setDialog(null);
            }}
          >
            ลบสมาชิก
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        title={`ลบ${group.name}?`}
        description="สมาชิก ลิงก์จ่ายเงิน และสถานะการจ่ายทุกเดือนจะถูกลบ กู้คืนไม่ได้"
      >
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setDialog(null)} autoFocus>
            ไม่ลบ
          </Button>
          <Button className="bg-danger text-night" onClick={removeGroup} disabled={pending}>
            ลบกลุ่ม
          </Button>
        </div>
      </Dialog>
    </>
  );
}
