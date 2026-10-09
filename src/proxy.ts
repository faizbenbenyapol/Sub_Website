import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

// ชั้นแรกของการกันหน้าเว็บ: ตรวจแค่ลายเซ็น JWT (เร็ว ไม่แตะ DB)
// ชั้นที่สองอยู่ใน layout ของ (app) และ admin ซึ่งโหลดผู้ใช้จาก DB จริง — API ตรวจเองทุกเส้นด้วย requireUser()

/** redirect ไปหน้า login ถ้ายังไม่ล็อกอิน และกัน /admin สำหรับคนที่ไม่ใช่ admin */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.rewrite(new URL("/forbidden", req.url), { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/subscriptions/:path*",
    "/calendar/:path*",
    "/settings/:path*",
    "/groups/:path*",
    "/savings/:path*",
    "/notifications/:path*",
    "/admin/:path*",
    "/report/:path*",
  ],
};
