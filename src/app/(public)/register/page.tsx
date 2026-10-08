import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { redirectIfSignedIn } from "@/server/auth";
import { googleEnabled } from "@/server/env";

export const metadata: Metadata = { title: "สมัครสมาชิก" };

/** หน้าสมัครสมาชิก */
export default async function RegisterPage() {
  await redirectIfSignedIn();
  return (
    <AuthShell
      title="สมัครสมาชิก"
      lead="จดทุกรายการที่ตัดเงินรายเดือนไว้ที่เดียว แล้วรับอีเมลเตือนก่อนโดนตัด"
    >
      <AuthForm mode="register" googleEnabled={googleEnabled} />
    </AuthShell>
  );
}
