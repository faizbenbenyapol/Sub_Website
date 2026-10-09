"use client";

import { useId, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  error?: string;
  hint?: string;
};

/** ช่องรหัสผ่านที่มีปุ่มรูปตาสลับดู/ซ่อน — หน้าตาและการผูก error เหมือน TextField */
export function PasswordField({ label, error, hint, id, className = "", ...props }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;
  const [visible, setVisible] = useState(false);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="text-caption font-medium text-text">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={`h-12 w-full rounded-control border bg-glass-strong pr-13 pl-4 text-body text-text placeholder:text-text-faint ${
            error ? "border-danger" : "border-line-strong focus:border-paid"
          } focus:outline-none focus-visible:outline-2 focus-visible:outline-paid`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
          aria-pressed={visible}
          aria-controls={inputId}
          className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-[10px] text-text-muted hover:bg-glass-strong hover:text-text"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="M4 20 20 4" strokeLinecap="round" />}
          </svg>
        </button>
      </div>
      {message && (
        <p id={messageId} className={`text-caption ${error ? "text-danger" : "text-text-muted"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
