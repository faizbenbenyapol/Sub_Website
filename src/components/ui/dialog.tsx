"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
};

/**
 * dialog แบบ modal จาก <dialog> ของเบราว์เซอร์ — กักโฟกัส ปิดด้วย Esc และคืนโฟกัสให้ปุ่มที่เปิดเองโดยไม่ต้องใช้ไลบรารี
 * พื้นเป็นสีทึบ (surface) เพราะอยู่บน backdrop มืด ไม่ใช่กระจกซ้อนกระจก
 */
export function Dialog({ open, onClose, title, description, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()} // คลิกนอกกล่องเพื่อปิด
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-card border border-line bg-surface p-0 text-text backdrop:bg-black/70"
    >
      {open && (
        <div className="p-5 md:p-6">
          <h2 id={titleId} className="text-h3 font-bold">
            {title}
          </h2>
          {description && <div className="mt-2 text-text-muted">{description}</div>}
          <div className="mt-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
