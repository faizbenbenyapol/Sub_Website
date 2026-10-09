/* eslint-disable @next/next/no-img-element -- โลโก้บริการในแผงตัวอย่างเป็นไฟล์ใน public ขนาดเล็ก */
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { VersionBadge } from "./version-badge";

/**
 * กรอบของหน้า login / register — ฟอร์มในการ์ดแก้วใบเดียว มีแสงเรืองสีโลโก้ด้านหลัง
 * จอใหญ่: ฝั่งขวาเป็นแผงตัวอย่างหน้าตาแอป (ภาพประกอบ ข้อมูลสมมติ) ให้เห็นว่าเข้าไปแล้วจะได้อะไร
 */
export function AuthShell({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[1120px] flex-col overflow-x-clip px-4 py-10 md:px-8 md:py-14">
      <div className="grid flex-1 items-center gap-16 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
        <div className="w-full max-w-md">
          {/* โลโก้อยู่ในคอลัมน์เดียวกับฟอร์ม — จอสูงแค่ไหนก็ไม่ลอยห่างจากฟอร์มที่จัดไว้กลางจอ */}
          <Link href="/" className="mb-10 flex w-fit items-center gap-3 font-display text-h3 font-bold">
            {/* width/height = ขนาดจริงของไฟล์ (198×256) ให้สัดส่วนตรง แล้วย่อด้วย CSS — ไม่งั้น next/image เตือนว่าบิดสัดส่วน */}
            <Image src="/brand/mark.png" alt="" width={198} height={256} priority className="h-16 w-auto" />
            ตัดยัง?
          </Link>
          <h1 className="text-h2 font-bold">{title}</h1>
          <p className="mt-2 text-text-muted">{lead}</p>
          <div className="relative isolate mt-8">
            {/* แสงเรืองสีเดียวกับโลโก้ (น้ำเงิน → ส้ม → เขียว) */}
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-8 -z-10 rounded-[48px] opacity-35 blur-3xl"
              style={{
                background:
                  "radial-gradient(60% 55% at 15% 25%, #3b4cf5, transparent 70%), radial-gradient(55% 50% at 85% 45%, #ff8a3d, transparent 70%), radial-gradient(60% 55% at 45% 95%, #c8f169, transparent 70%)",
              }}
            />
            <div className="glass rounded-card p-5 md:p-6">{children}</div>
          </div>
          <div className="mt-4">
            <VersionBadge />
          </div>
        </div>
        <Showcase />
      </div>
    </main>
  );
}

const SAMPLE = [
  {
    name: "Netflix",
    logo: "/logos/netflix.svg",
    when: "อีก 2 วัน",
    soon: true,
    amount: "฿419.00",
    date: "ศ. 9 ต.ค.",
  },
  {
    name: "Spotify",
    logo: "/logos/spotify.svg",
    when: "อีก 5 วัน",
    soon: false,
    amount: "฿249.00",
    date: "จ. 12 ต.ค.",
  },
  {
    name: "iCloud+",
    logo: "/logos/icloud-plus.png",
    when: "อีก 9 วัน",
    soon: false,
    amount: "฿99.00",
    date: "ศ. 16 ต.ค.",
  },
];

/** แผงตัวอย่างฝั่งขวา (เฉพาะจอใหญ่) — ภาพประกอบล้วน screen reader ได้แค่ประโยคสรุป */
function Showcase() {
  return (
    <section aria-label="ตัวอย่างสิ่งที่ตัดยัง? ทำให้" className="hidden lg:block">
      <div aria-hidden className="relative mx-auto max-w-[26rem] rotate-[-2deg]">
        <div className="relative overflow-hidden rounded-hero bg-slip p-6 shadow-[0_30px_80px_rgb(59_76_245/0.35)]">
          <span className="absolute -top-12 -right-12 size-36 rounded-full bg-due" />
          <span className="absolute top-16 -right-3 size-16 rounded-full bg-paid" />
          <p className="relative font-display font-semibold">เดือนนี้จ่าย</p>
          <p className="figure relative mt-1 text-[40px] leading-tight font-semibold">฿1,068.00</p>
          <p className="relative mt-1 text-caption text-white/85">ปีละ ฿12,816 · 4 รายการ</p>
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {SAMPLE.map((s, i) => (
            <li
              key={s.name}
              className="glass grid grid-cols-[minmax(0,1fr)_8.5rem] rounded-card"
              style={{ marginLeft: `${i * 14}px`, marginRight: `${-i * 14}px` }}
            >
              <span className="flex items-center gap-3 py-3.5 pr-3 pl-4">
                <img src={s.logo} alt="" className="size-9 rounded-logo bg-white object-contain p-1" />
                <span>
                  <span className="block font-display font-semibold">{s.name}</span>
                  <span className="block text-caption text-text-muted">ตัดเงิน</span>
                </span>
              </span>
              <span className="relative flex flex-col items-end justify-center border-l-[1.5px] border-dashed border-line-strong py-3 pr-4 pl-4">
                <span className="absolute -top-2 -left-2 size-4 rounded-full bg-night" />
                <span className="absolute -bottom-2 -left-2 size-4 rounded-full bg-night" />
                <span className={`text-caption ${s.soon ? "font-semibold text-due" : "text-text-muted"}`}>
                  {s.when}
                </span>
                <span className="figure leading-tight">{s.amount}</span>
                <span className="text-[11px] text-text-muted">{s.date}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mx-auto mt-10 max-w-[26rem] font-display text-lead font-semibold">
        รู้ก่อนโดนตัดเงิน ทุกบริการในที่เดียว
      </p>
      <ul className="mx-auto mt-3 flex max-w-[26rem] flex-col gap-2 text-text-muted">
        {[
          "อีเมลเตือนก่อนถึงวันตัดเงิน",
          "หารค่า Family plan กับเพื่อนด้วย QR พร้อมเพย์",
          "ราคาบริการในไทยเป็นเงินบาท พร้อมวิธียกเลิก",
        ].map((t) => (
          <li key={t} className="flex items-start gap-2.5">
            <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-paid" />
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}
