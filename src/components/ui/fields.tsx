import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

// ช่องกรอกแบบอื่นนอกจาก TextField — กฎเดียวกัน: label อยู่บน, error ใต้ช่อง, ผูกด้วย aria-describedby
// padding แนวนอนใส่แยกแต่ละช่อง — <select> ไม่ใส่ เพราะ globals.css จัดเว้นที่ให้ลูกศรเอง

const controlClass = (error?: string) =>
  `rounded-control border bg-glass-strong text-body text-text ${
    error ? "border-danger" : "border-line-strong focus:border-paid"
  } focus:outline-none focus-visible:outline-2 focus-visible:outline-paid`;

/** ส่วนหัว (label) และข้อความใต้ช่องที่ใช้ร่วมกัน */
function FieldFrame({
  id,
  label,
  error,
  hint,
  className = "",
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  const message = error ?? hint;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-caption font-medium text-text">
        {label}
      </label>
      {children}
      {message && (
        <p id={`${id}-message`} className={`text-caption ${error ? "text-danger" : "text-text-muted"}`}>
          {message}
        </p>
      )}
    </div>
  );
}

type Common = { label: string; error?: string; hint?: string; className?: string };

/** ดรอปดาวน์เลือกค่า */
export function SelectField({
  label,
  error,
  hint,
  className,
  children,
  ...props
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} error={error} hint={hint} className={className}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-message` : undefined}
        className={`h-12 ${controlClass(error)}`}
        {...props}
      >
        {children}
      </select>
    </FieldFrame>
  );
}

/** ช่องข้อความหลายบรรทัด */
export function TextareaField({
  label,
  error,
  hint,
  className,
  ...props
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} error={error} hint={hint} className={className}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-message` : undefined}
        className={`min-h-32 px-4 py-3 ${controlClass(error)}`}
        {...props}
      />
    </FieldFrame>
  );
}

/** ช่องเงินบาท: มี ฿ นำหน้าและใช้ตัวเลข mono (docs/03 ข้อ 5) */
export function MoneyField({
  label,
  error,
  hint,
  className,
  ...props
}: Common & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} error={error} hint={hint} className={className}>
      <div className="relative">
        <span
          aria-hidden
          className="figure pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-text-muted"
        >
          ฿
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-message` : undefined}
          className={`figure h-12 w-full pr-4 pl-9 ${controlClass(error)}`}
          {...props}
        />
      </div>
    </FieldFrame>
  );
}

/** ช่องติ๊กเปิด/ปิด พร้อมคำอธิบาย — เป้ากดสูง 44px */
export function CheckboxField({
  label,
  description,
  ...props
}: { label: string; description?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-start gap-3">
      <input id={id} type="checkbox" className="mt-1.5 size-5 accent-paid" {...props} />
      <label htmlFor={id} className="flex flex-col">
        <span className="font-medium">{label}</span>
        {description && <span className="text-caption text-text-muted">{description}</span>}
      </label>
    </div>
  );
}
