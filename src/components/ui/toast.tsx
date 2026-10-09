"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Tone = "success" | "error";
type Toast = { id: number; message: string; tone: Tone };

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

/** แสดงข้อความยืนยันผลการกระทำ เช่น "ซ่อน Netflix แล้ว" — ใช้: const toast = useToast(); toast("...") */
export function useToast() {
  return useContext(ToastContext);
}

const TONE_BAR: Record<Tone, string> = { success: "border-l-paid", error: "border-l-danger" };

/** ตัวจัดการ toast ระดับแอป: มือถืออยู่ล่างกลาง (ระยะนิ้วโป้ง) desktop อยู่ขวาล่าง หายเองใน 4 วินาที */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: Tone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-24 z-50 flex flex-col items-center gap-2 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:items-end"
      >
        {toasts.map((t) => (
          <p
            key={t.id}
            className={`w-full max-w-sm rounded-control border border-l-[3px] border-line bg-surface px-4 py-3 text-text shadow-[0_8px_24px_rgb(0_0_0/0.45)] ${TONE_BAR[t.tone]}`}
          >
            {t.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
