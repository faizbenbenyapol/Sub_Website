import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-paid text-night",
  secondary: "glass border-line-strong text-text",
  danger: "glass border-line-strong text-danger",
};

/** ปุ่มตาม docs/03-design.md ข้อ 5 — สูง 48px, ข้อความต้องบอกผลที่จะเกิดขึ้น */
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-control px-6 font-display font-semibold transition-transform duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
