"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { apiFetch } from "@/lib/api-client";
import { safeNextPath } from "@/lib/safe-next";
import { fieldErrors } from "@/lib/validation";
import { loginSchema, registerSchema } from "@/lib/validation/auth";

type Mode = "login" | "register";
type Me = { role: "user" | "admin" };

/** ป้องกัน open redirect: รับเฉพาะ path ภายในเว็บ ไม่งั้นไปหน้าแรกตาม role */
function safeNext(next: string | undefined, role: Me["role"]) {
  return safeNextPath(next) ?? (role === "admin" ? "/admin" : "/dashboard");
}

// ข้อความจาก ?error= ที่ /api/auth/google/callback ส่งกลับมา
const GOOGLE_ERRORS: Record<string, string> = {
  google: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองใหม่อีกครั้ง",
  unverified: "อีเมลของบัญชี Google นี้ยังไม่ได้ยืนยัน ใช้บัญชีอื่นหรือสมัครด้วยอีเมลแทน",
  suspended: "บัญชีนี้ถูกระงับ ติดต่อผู้ดูแลระบบ",
};

/** ฟอร์มสมัครสมาชิก / เข้าสู่ระบบ — validate ด้วย schema เดียวกับ API ก่อนส่ง */
export function AuthForm({
  mode,
  next,
  googleEnabled = false,
  error,
}: {
  mode: Mode;
  next?: string;
  googleEnabled?: boolean;
  error?: string;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>(error ? GOOGLE_ERRORS[error] : undefined);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(undefined);
    const values = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = (mode === "login" ? loginSchema : registerSchema).safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    const res = await apiFetch<Me>(`/api/auth/${mode}`, { method: "POST", body: parsed.data });
    setPending(false);
    if (!res.ok) {
      if (res.error.fields) setErrors(res.error.fields);
      else setFormError(res.error.message);
      return;
    }
    router.replace(safeNext(next, res.data.role));
    router.refresh();
  }

  const isLogin = mode === "login";
  const nextPath = safeNextPath(next);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {googleEnabled && (
        <>
          {/* ลิงก์ธรรมดา (ไม่ใช่ fetch) เพราะต้องพาทั้งหน้าไปที่ Google */}
          <a
            href={`/api/auth/google${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
            className="glass inline-flex h-12 w-full items-center justify-center gap-3 rounded-control border-line-strong px-6 font-display font-semibold text-text"
          >
            <svg aria-hidden viewBox="0 0 48 48" className="size-5">
              <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
              />
              <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
              />
            </svg>
            {isLogin ? "เข้าสู่ระบบด้วย Google" : "สมัครด้วย Google"}
          </a>
          <p className="flex items-center gap-3 text-caption text-text-muted" aria-hidden>
            <span className="h-px flex-1 bg-line" /> หรือใช้อีเมล <span className="h-px flex-1 bg-line" />
          </p>
        </>
      )}
      {!isLogin && <TextField label="ชื่อ" name="name" autoComplete="name" error={errors.name} />}
      <TextField
        label="อีเมล"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        error={errors.email}
      />
      <TextField
        label="รหัสผ่าน"
        name="password"
        type="password"
        autoComplete={isLogin ? "current-password" : "new-password"}
        hint={isLogin ? undefined : "อย่างน้อย 8 ตัวอักษร"}
        error={errors.password}
      />

      {formError && (
        <p role="alert" className="border-l-[3px] border-danger pl-3 text-text">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "กำลังตรวจสอบ…" : isLogin ? "เข้าสู่ระบบ" : "สมัครและเข้าสู่ระบบ"}
      </Button>

      <p className="text-center text-text-muted">
        {isLogin ? "ยังไม่มีบัญชี? " : "มีบัญชีแล้ว? "}
        <Link
          href={isLogin ? "/register" : "/login"}
          className="font-medium text-link underline underline-offset-4"
        >
          {isLogin ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
        </Link>
      </p>
    </form>
  );
}
