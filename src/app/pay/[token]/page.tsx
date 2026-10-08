import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { formatBaht } from "@/lib/money";
import { getPayPage } from "@/server/services/groups";

// หน้าจ่ายเงินของสมาชิกกลุ่ม (US-F2) — คนนอกเปิดได้โดยไม่ล็อกอิน เข้าถึงด้วย token ที่เดาไม่ได้เท่านั้น
export const metadata: Metadata = {
  title: "จ่ายค่าบริการ",
  robots: { index: false, follow: false },
  referrer: "no-referrer", // ไม่ส่ง URL ที่มี token ไปให้เว็บอื่นผ่าน Referer
};

/** หน้าเดียวที่คนนอกเห็น: ใครขอเก็บ · ยอดเท่าไร · สแกน QR — ไม่มีเมนู ไม่มีข้อมูลสมาชิกคนอื่น */
export default async function PayPage({ params }: PageProps<"/pay/[token]">) {
  const page = await getPayPage((await params).token);
  if (!page) notFound();
  // SVG สร้างจาก payload ที่เป็นตัวเลข/ตัวอักษรตามมาตรฐาน EMVCo ฝั่ง server — ไม่มีข้อความจากผู้ใช้ปนอยู่
  const paid = page.status === "paid";
  // ไม่ต้องจ่าย: เจ้าของเลิกหาร/บัญชีถูกระงับ หรือยอดเป็น 0 (QR ที่ไม่มียอดจะให้เพื่อนกรอกเองซึ่งขัดกับข้อความในหน้า)
  const nothingToPay = page.closed || page.amount === 0;
  const qrSvg =
    paid || nothingToPay
      ? ""
      : await QRCode.toString(page.payload, { type: "svg", margin: 2, errorCorrectionLevel: "M" });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6">
      <p className="font-display text-lead font-bold">ตัดยัง?</p>

      <section className="relative mt-4 overflow-hidden rounded-hero bg-slip p-6">
        <span aria-hidden className="absolute -top-14 -right-14 size-36 rounded-full bg-due" />
        <h1 className="relative max-w-[15rem] text-lead leading-snug font-semibold">
          {page.ownerName} ขอเก็บค่า {page.serviceName} เดือน{page.periodLabel}
        </h1>
        <p className="relative mt-1 text-white/85">ส่วนของ{page.memberName}</p>
        <p className="figure relative mt-4 text-[44px] leading-none font-semibold">
          {formatBaht(page.amount)}
        </p>
      </section>

      {page.closed ? (
        <section className="glass mt-6 rounded-card p-6 text-center">
          <p className="text-h3 font-bold">ไม่ต้องจ่ายแล้ว</p>
          <p className="mt-2 text-text-muted">
            {page.ownerName} เลิกหารค่า {page.serviceName} แล้ว ลิงก์นี้ไม่ใช้เก็บเงินอีก
          </p>
        </section>
      ) : paid ? (
        <section className="glass mt-6 rounded-card p-6 text-center">
          <p className="text-h3 font-bold">
            <span aria-hidden className="mr-2 inline-block size-3 rounded-full bg-paid" />
            จ่ายแล้ว
          </p>
          <p className="mt-2 text-text-muted">{page.ownerName} ทำเครื่องหมายว่าได้รับเงินเดือนนี้แล้ว</p>
        </section>
      ) : nothingToPay ? (
        <section className="glass mt-6 rounded-card p-6 text-center">
          <p className="text-h3 font-bold">ไม่มียอดต้องจ่ายเดือนนี้</p>
          <p className="mt-2 text-text-muted">{page.ownerName} ไม่ได้ตั้งยอดให้คุณในกลุ่มนี้</p>
        </section>
      ) : (
        <section aria-labelledby="qr-heading" className="mt-6 flex flex-col items-center">
          <h2 id="qr-heading" className="sr-only">
            QR พร้อมเพย์
          </h2>
          {/* พื้นขาวเสมอ แอปธนาคารสแกนได้แม้หน้าจอเป็นโหมดมืด */}
          <div
            role="img"
            aria-label={`QR พร้อมเพย์ ยอด ${formatBaht(page.amount)}`}
            className="w-64 max-w-full rounded-card bg-white p-3 [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="mt-4 text-center">
            สแกนด้วยแอปธนาคาร ยอดเงินกรอกให้แล้ว
            <span className="mt-1 block text-caption text-text-muted">
              พร้อมเพย์ {page.promptpayIdMasked} · ชื่อบัญชีของ{page.ownerName}จะขึ้นในแอปธนาคารตอนสแกน
            </span>
          </p>
          <p className="mt-4 text-caption text-text-muted">
            สถานะ: <span className="text-text">ยังไม่จ่าย</span> — เจ้าของกลุ่มจะทำเครื่องหมายหลังได้รับเงิน
          </p>
        </section>
      )}
    </main>
  );
}
