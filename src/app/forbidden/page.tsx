import type { Metadata } from "next";
import { ForbiddenNotice } from "@/components/forbidden-notice";

export const metadata: Metadata = { title: "ไม่มีสิทธิ์เข้าถึง", robots: { index: false } };

/** ปลายทางที่ proxy rewrite มาเมื่อคนที่ไม่ใช่ admin เข้า /admin (status 403) */
export default function ForbiddenPage() {
  return <ForbiddenNotice />;
}
