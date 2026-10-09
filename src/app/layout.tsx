import type { Metadata } from "next";
import { Bai_Jamjuree, IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Thai } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

// ฟอนต์ตาม docs/03-design.md ข้อ 3 — โหลดเฉพาะน้ำหนักที่ใช้จริง
const baiJamjuree = Bai_Jamjuree({
  variable: "--font-bai-jamjuree",
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
});

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
});

// สำรองสำหรับตัวอักษรละตินที่ IBM Plex Sans Thai ไม่มี — แทบไม่ถูกใช้ จึงไม่ preload
// (preload ไว้ทุกหน้าแต่ไม่ได้ใช้ = เบราว์เซอร์เตือน "preloaded but not used" และเปลืองแบนด์วิดท์)
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  preload: false,
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: { default: "ตัดยัง?", template: "%s · ตัดยัง?" },
  description:
    "รวม subscription ที่สมัครไว้ เตือนทางอีเมลก่อนตัดเงิน และหารค่า Family plan กับเพื่อนด้วย QR พร้อมเพย์",
};

/** layout รากของทั้งเว็บ — ตั้งภาษาไทยและผูกตัวแปรฟอนต์ */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${baiJamjuree.variable} ${plexThai.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
