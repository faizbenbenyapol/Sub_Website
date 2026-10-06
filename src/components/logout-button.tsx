"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api-client";

/** ปุ่มออกจากระบบ — ลบ cookie ผ่าน API แล้วพากลับหน้า login */
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

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
      className="min-h-11 rounded-control px-3 text-text-muted hover:text-text"
    >
      ออกจากระบบ
    </button>
  );
}
