import Link from "next/link";
import type { ReactNode } from "react";

/** กรอบของหน้า login / register — ฟอร์มอยู่ในการ์ดแก้วใบเดียว ชิดซ้ายบน desktop */
export function AuthShell({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[1120px] flex-col px-4 py-10 md:px-8 md:py-16">
      <Link href="/" className="font-display text-lead font-bold">
        ตัดยัง?
      </Link>
      <div className="mt-10 w-full max-w-md md:mt-16">
        <h1 className="text-h2 font-bold">{title}</h1>
        <p className="mt-2 text-text-muted">{lead}</p>
        <div className="glass mt-8 rounded-card p-5 md:p-6">{children}</div>
      </div>
    </main>
  );
}
