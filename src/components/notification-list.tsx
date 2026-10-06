"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { formatThaiDateTime } from "@/lib/dates";
import type { NotificationDto } from "@/server/services/notifications";

/** รายการแจ้งเตือนในเว็บ (US-E3): กดแล้วทำเครื่องหมายอ่านและพาไปหน้าที่เกี่ยวข้อง */
export function NotificationList({ items, unreadCount }: { items: NotificationDto[]; unreadCount: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function open(n: NotificationDto) {
    if (!n.readAt) await apiFetch(`/api/notifications/${n.id}/read`, { method: "POST" });
    if (n.link) router.push(n.link);
    router.refresh();
  }

  async function readAll() {
    setPending(true);
    await apiFetch("/api/notifications/read-all", { method: "POST" });
    setPending(false);
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <p className="mt-6 max-w-md text-text-muted">
        ยังไม่มีการแจ้งเตือน — เมื่อใกล้วันตัดเงิน ระบบจะส่งอีเมลและแสดงที่นี่ด้วย
      </p>
    );
  }

  return (
    <>
      {unreadCount > 0 && (
        <Button variant="secondary" className="mt-4" onClick={readAll} disabled={pending}>
          อ่านทั้งหมด ({unreadCount})
        </Button>
      )}
      <ul className="glass mt-5 rounded-card">
        {items.map((n) => (
          <li key={n.id} className="border-b border-line last:border-0">
            <button
              type="button"
              onClick={() => open(n)}
              className="flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-glass md:px-5"
            >
              <span
                aria-hidden
                className={`mt-2.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-due"}`}
              />
              <span className="min-w-0 flex-1">
                <span className={`block ${n.readAt ? "text-text-muted" : "font-semibold"}`}>
                  {!n.readAt && <span className="sr-only">ยังไม่อ่าน: </span>}
                  {n.title}
                </span>
                <span className="block text-caption text-text-muted">{n.body}</span>
                <span className="block text-caption text-text-faint">{formatThaiDateTime(n.createdAt)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
