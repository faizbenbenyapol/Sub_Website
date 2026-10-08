import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { attachSession } from "@/server/auth";
import { env, googleEnabled } from "@/server/env";
import { decodePending, exchangeCodeForProfile, OAUTH_COOKIE, OAUTH_COOKIE_PATH } from "@/server/google";
import { api } from "@/server/http";
import { GoogleSignInError, signInWithGoogle } from "@/server/services/google-auth";

/** เทียบ state แบบเวลาคงที่ */
function sameState(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** redirect ภายในเว็บ + ลบ cookie ชั่วคราวเสมอ (ใช้ได้ครั้งเดียว) */
function redirectTo(path: string) {
  const res = NextResponse.redirect(new URL(path, env.APP_URL));
  res.cookies.set(OAUTH_COOKIE, "", { httpOnly: true, path: OAUTH_COOKIE_PATH, maxAge: 0 });
  return res;
}

/**
 * Google ส่งผู้ใช้กลับมาที่นี่พร้อม code — ตรวจ state, แลก code เป็นโปรไฟล์ที่ตรวจลายเซ็นแล้ว, หา/สร้างบัญชี แล้วตั้ง session
 * ผิดพลาดทุกกรณีพากลับหน้า login พร้อม ?error= (ไม่โชว์ JSON ให้ผู้ใช้)
 */
export const GET = api(async (req) => {
  if (!googleEnabled) return redirectTo("/login?error=google");
  const params = new URL(req.url).searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const pending = decodePending((await cookies()).get(OAUTH_COOKIE)?.value);
  if (!code || !state || !pending || !sameState(state, pending.s)) return redirectTo("/login?error=google");

  let profile;
  try {
    profile = await exchangeCodeForProfile(code, pending.v);
  } catch (err) {
    console.error("[google] แลก code ไม่สำเร็จ", err);
    return redirectTo("/login?error=google");
  }

  try {
    const user = await signInWithGoogle(profile);
    return attachSession(redirectTo(pending.n ?? (user.role === "admin" ? "/admin" : "/dashboard")), user);
  } catch (err) {
    if (err instanceof GoogleSignInError) return redirectTo(`/login?error=${err.reason}`);
    throw err;
  }
});
