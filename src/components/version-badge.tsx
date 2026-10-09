"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { APP_VERSION, userReleases, type Release } from "@/lib/changelog";
import { formatThaiDate } from "@/lib/dates";

/**
 * ป้ายเวอร์ชันหน้าเข้าสู่ระบบ — กดแล้วเห็นว่ามีอะไรใหม่ (เฉพาะสิ่งที่ผู้ใช้เห็น ไม่รวมงานหลังบ้าน)
 * เวอร์ชันล่าสุดกางไว้ เวอร์ชันก่อน ๆ เป็นแถบกดเปิด/ปิด (<details>) · เก่ากว่า 5 เวอร์ชันไม่แสดง
 */
export function VersionBadge() {
  const [open, setOpen] = useState(false);
  const [latest, ...older] = userReleases(); // 5 เวอร์ชันล่าสุด ไม่รวมงานหลังบ้าน

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-caption text-text-muted hover:text-text"
      >
        <span className="figure rounded-full border border-line-strong px-2.5 py-0.5 text-text">
          v{APP_VERSION}
        </span>
        มีอะไรใหม่
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="มีอะไรใหม่ใน ตัดยัง?"
        description={`เวอร์ชันล่าสุด v${APP_VERSION}`}
      >
        <div className="flex max-h-[60dvh] flex-col gap-3 overflow-y-auto pr-1">
          {latest && <ReleaseNotes release={latest} current />}
          {older.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <p className="text-caption text-text-muted">เวอร์ชันก่อนหน้า</p>
              <ul className="mt-2 flex flex-col gap-2">
                {older.map((r) => (
                  <li key={r.version}>
                    <details className="group rounded-control border border-line">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
                        <ReleaseHeading release={r} />
                        <svg
                          aria-hidden
                          viewBox="0 0 24 24"
                          className="ml-auto size-4 shrink-0 text-text-muted transition-transform group-open:rotate-180"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </summary>
                      <div className="px-3 pb-3">
                        <ChangeList release={r} />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => setOpen(false)}
            autoFocus
            className="min-h-11 rounded-control px-4 font-semibold text-link hover:bg-glass-strong"
          >
            ปิด
          </button>
        </div>
      </Dialog>
    </>
  );
}

/** หัวของแต่ละเวอร์ชัน: เลขเวอร์ชัน · ชื่อ · วันที่ (current = เวอร์ชันล่าสุด ป้ายสีเขียว) */
function ReleaseHeading({ release, current = false }: { release: Release; current?: boolean }) {
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
      <span
        className={`figure rounded-full px-2.5 py-0.5 text-caption font-semibold ${
          current ? "bg-paid text-night" : "border border-line-strong text-text"
        }`}
      >
        v{release.version}
      </span>
      <span className="font-display font-semibold">{release.title}</span>
      <span className="text-caption text-text-muted">{formatThaiDate(release.date, "medium")}</span>
    </span>
  );
}

/** รายการสิ่งที่เปลี่ยนในเวอร์ชันนั้น */
function ChangeList({ release }: { release: Release }) {
  return (
    <ul className="mt-2.5 flex flex-col gap-1.5">
      {release.changes.map((c) => (
        <li key={c.text} className="flex items-start gap-2.5 text-text-muted">
          <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-paid" />
          {c.text}
        </li>
      ))}
    </ul>
  );
}

/** เวอร์ชันล่าสุดแบบกางไว้ */
function ReleaseNotes({ release, current }: { release: Release; current?: boolean }) {
  return (
    <section>
      <ReleaseHeading release={release} current={current} />
      <ChangeList release={release} />
    </section>
  );
}
