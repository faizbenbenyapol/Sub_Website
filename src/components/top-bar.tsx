import Link from "next/link";
import { LogoutButton } from "./logout-button";

/** แถบบนชั่วคราวของหน้าที่ต้องล็อกอิน — เมนูเต็ม (แถบล่างมือถือ) ทำวันที่ 5 ตาม docs/03 ข้อ 6 */
export function TopBar({ name, isAdmin, home }: { name: string; isAdmin: boolean; home: string }) {
  return (
    <header className="glass sticky top-0 z-10 border-x-0 border-t-0">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-4 px-4 md:px-8">
        <Link href={home} className="font-display text-lead font-bold">
          ตัดยัง?
        </Link>
        {isAdmin && (
          <nav aria-label="สลับส่วน" className="flex gap-1 text-caption">
            <Link href="/dashboard" className="rounded-tag px-2 py-1 hover:bg-glass-strong">
              ฝั่งผู้ใช้
            </Link>
            <Link href="/admin" className="rounded-tag px-2 py-1 hover:bg-glass-strong">
              หลังบ้าน
            </Link>
          </nav>
        )}
        <span className="ml-auto hidden truncate text-text-muted sm:block">{name}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
