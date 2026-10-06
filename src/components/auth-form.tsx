"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { apiFetch } from "@/lib/api-client";
import { fieldErrors } from "@/lib/validation";
import { loginSchema, registerSchema } from "@/lib/validation/auth";

type Mode = "login" | "register";
type Me = { role: "user" | "admin" };

/** ป้องกัน open redirect: รับเฉพาะ path ภายในเว็บ */
function safeNext(next: string | undefined, role: Me["role"]) {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return role === "admin" ? "/admin" : "/dashboard";
}

/** ฟอร์มสมัครสมาชิก / เข้าสู่ระบบ — validate ด้วย schema เดียวกับ API ก่อนส่ง */
export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
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
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
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
