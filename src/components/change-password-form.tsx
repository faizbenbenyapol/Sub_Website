"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { fieldErrors } from "@/lib/validation";
import { changePasswordSchema } from "@/lib/validation/auth";

/**
 * เปลี่ยนรหัสผ่าน (หน้าตั้งค่า): ยืนยันรหัสเดิมก่อน → ช่องรหัสใหม่จึงกรอกได้
 * บัญชีที่เข้าด้วย Google อย่างเดียว (hasPassword=false) ข้ามขั้นยืนยัน เป็นการ "ตั้งรหัสผ่าน" ครั้งแรก
 */
export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [verified, setVerified] = useState(!hasPassword);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [formKey, setFormKey] = useState(0); // เปลี่ยน key = ล้างช่องรหัสใหม่ทั้งหมดหลังเปลี่ยนสำเร็จ

  /** ขั้นที่ 1: ตรวจรหัสเดิมกับ server ถูกแล้วปลดล็อกช่องรหัสใหม่ */
  async function verify() {
    if (!current) return setErrors({ currentPassword: "กรอกรหัสผ่านเดิม" });
    setPending(true);
    const res = await apiFetch("/api/me/password/verify", {
      method: "POST",
      body: { currentPassword: current },
    });
    setPending(false);
    if (!res.ok) return setErrors(res.error.fields ?? { currentPassword: res.error.message });
    setErrors({});
    setVerified(true);
  }

  /** ขั้นที่ 2: ส่งรหัสใหม่ (server ตรวจรหัสเดิมซ้ำ) สำเร็จแล้วล้างฟอร์ม */
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!verified) return verify(); // กด Enter ในช่องรหัสเดิม = ยืนยันรหัสเดิม
    const values = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const parsed = changePasswordSchema.safeParse({
      ...values,
      currentPassword: hasPassword ? current : undefined,
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setPending(true);
    const res = await apiFetch("/api/me/password", { method: "PATCH", body: parsed.data });
    setPending(false);
    if (!res.ok) {
      setErrors(res.error.fields ?? {});
      if (!res.error.fields) toast(res.error.message, "error");
      // รหัสเดิมกลายเป็นผิด (เช่น เปลี่ยนจากอีกเครื่องไปแล้ว) → กลับไปขั้นยืนยัน
      if (res.error.fields?.currentPassword) setVerified(false);
      return;
    }
    toast(
      hasPassword ? "เปลี่ยนรหัสผ่านแล้ว เครื่องอื่นที่ล็อกอินอยู่ต้องเข้าสู่ระบบใหม่" : "ตั้งรหัสผ่านแล้ว",
    );
    setErrors({});
    setCurrent("");
    setVerified(!hasPassword);
    setFormKey((k) => k + 1);
    // บัญชี Google ที่เพิ่งตั้งรหัสครั้งแรก: โหลดหน้าใหม่ให้ hasPassword เป็น true ครั้งหน้าจะได้ถามรหัสเดิม
    if (!hasPassword) router.refresh();
  }

  return (
    <form key={formKey} onSubmit={submit} noValidate className="flex flex-col gap-5">
      {hasPassword && (
        <div className="flex flex-col gap-3">
          <PasswordField
            label="รหัสผ่านเดิม"
            name="currentPassword"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            readOnly={verified}
            error={errors.currentPassword}
            hint={verified ? "ยืนยันรหัสเดิมแล้ว กรอกรหัสใหม่ด้านล่างได้เลย" : undefined}
          />
          {!verified && (
            <div>
              <Button type="button" variant="secondary" onClick={verify} disabled={pending}>
                {pending ? "กำลังตรวจสอบ…" : "ยืนยันรหัสเดิม"}
              </Button>
            </div>
          )}
        </div>
      )}

      <fieldset disabled={!verified} className="flex flex-col gap-5 disabled:opacity-45">
        {hasPassword && <legend className="sr-only">รหัสผ่านใหม่ (กรอกได้หลังยืนยันรหัสเดิม)</legend>}
        <PasswordField
          label="รหัสผ่านใหม่"
          name="newPassword"
          autoComplete="new-password"
          hint="อย่างน้อย 8 ตัวอักษร"
          error={errors.newPassword}
        />
        <PasswordField
          label="ยืนยันรหัสผ่านใหม่"
          name="confirmPassword"
          autoComplete="new-password"
          error={errors.confirmPassword}
        />
        <div>
          <Button type="submit" disabled={pending || !verified}>
            {pending && verified ? "กำลังบันทึก…" : hasPassword ? "เปลี่ยนรหัสผ่าน" : "ตั้งรหัสผ่าน"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
