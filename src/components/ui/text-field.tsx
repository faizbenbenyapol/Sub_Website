import { useId, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

/** ช่องกรอกที่มี label ด้านบนเสมอ และ error ใต้ช่องที่ผูกด้วย aria-describedby */
export function TextField({ label, error, hint, id, className = "", ...props }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="text-caption font-medium text-text">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={`h-12 rounded-control border bg-glass-strong px-4 text-body text-text placeholder:text-text-faint ${
          error ? "border-danger" : "border-line-strong focus:border-paid"
        } focus:outline-none focus-visible:outline-2 focus-visible:outline-paid`}
        {...props}
      />
      {message && (
        <p id={messageId} className={`text-caption ${error ? "text-danger" : "text-text-muted"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
