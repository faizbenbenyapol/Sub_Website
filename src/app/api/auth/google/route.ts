import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/safe-next";
import { env, googleEnabled } from "@/server/env";
import {
  encodePending,
  googleAuthUrl,
  newOAuthSecrets,
  OAUTH_COOKIE,
  OAUTH_COOKIE_PATH,
} from "@/server/google";
import { api, ApiError, queryParam } from "@/server/http";

/** เริ่มเข้าสู่ระบบด้วย Google: จำ state + PKCE verifier ไว้ใน cookie แล้วพาไปหน้าเลือกบัญชีของ Google */
export const GET = api(async (req) => {
  if (!googleEnabled) throw new ApiError(404, "NOT_FOUND", "ยังไม่ได้ตั้งค่าเข้าสู่ระบบด้วย Google");
  const { state, verifier } = newOAuthSecrets();
  const res = NextResponse.redirect(googleAuthUrl(state, verifier));
  res.cookies.set(
    OAUTH_COOKIE,
    encodePending({ s: state, v: verifier, n: safeNextPath(queryParam(req, "next")) }),
    {
      httpOnly: true,
      sameSite: "lax", // Google พากลับมาแบบ top-level GET จึงยังส่ง cookie มา
      secure: env.APP_URL.startsWith("https://"),
      path: OAUTH_COOKIE_PATH,
      maxAge: 10 * 60,
    },
  );
  return res;
});
