"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api-client";

/** ปุ่มออกจากระบบ — ลบ cookie ผ่าน API แล้วพากลับหน้า login */
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  /** ออกจากระบบแล้วพาไปหน้าเข้าสู่ระบบ */
  async function logout() {
    setPending(true);
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className="min-h-11 rounded-control px-2.5 whitespace-nowrap text-text-muted hover:text-text"
    >
      ออกจากระบบ
    </button>
  );
}
