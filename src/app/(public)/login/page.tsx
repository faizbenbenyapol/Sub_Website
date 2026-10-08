import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { redirectIfSignedIn } from "@/server/auth";
import { googleEnabled } from "@/server/env";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

/** หน้าเข้าสู่ระบบ — รับ ?next= จาก proxy เพื่อพากลับไปหน้าที่ตั้งใจจะเข้า */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  await redirectIfSignedIn();
  const { next, error } = await searchParams;
  return (
    <AuthShell title="เข้าสู่ระบบ" lead="ดูว่าเดือนนี้มีอะไรจะตัดเงินบ้าง">
      <AuthForm
        mode="login"
        next={typeof next === "string" ? next : undefined}
        googleEnabled={googleEnabled}
        error={typeof error === "string" ? error : undefined}
      />
    </AuthShell>
  );
}
