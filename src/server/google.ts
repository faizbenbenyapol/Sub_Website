import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "./env";

// เข้าสู่ระบบด้วย Google แบบ OAuth 2.0 Authorization Code + PKCE (docs/05-deploy.md)
// แยกส่วนที่คุยกับ Google ไว้ไฟล์นี้ไฟล์เดียว เทส integration จึง mock ได้โดยไม่ต้องต่อเน็ต

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export type GoogleProfile = { sub: string; email: string; emailVerified: boolean; name: string | null };

/** URL ที่ Google ส่งผู้ใช้กลับมา — ต้องตรงกับที่ลงทะเบียนใน Google Cloud Console ทุกตัวอักษร */
export const googleRedirectUri = () => `${env.APP_URL}/api/auth/google/callback`;

/** สุ่ม state (กัน CSRF ของ callback) และ code verifier ของ PKCE */
export function newOAuthSecrets() {
  return { state: randomBytes(24).toString("base64url"), verifier: randomBytes(32).toString("base64url") };
}

/** หน้าเลือกบัญชีของ Google */
export function googleAuthUrl(state: string, verifier: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params}`;
}

/** แลก code เป็น id_token แล้วตรวจลายเซ็นกับ key ของ Google — ผิดตรงไหนโยน error */
export async function exchangeCodeForProfile(code: string, verifier: string): Promise<GoogleProfile> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      code_verifier: verifier,
      client_id: env.GOOGLE_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token endpoint ตอบ ${res.status}`);
  const { id_token: idToken } = (await res.json()) as { id_token?: string };
  if (!idToken) throw new Error("Google ไม่ส่ง id_token มา");

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env.GOOGLE_CLIENT_ID,
  });
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("id_token ไม่มี sub หรือ email");
  }
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : null,
  };
}

// ─── cookie ชั่วคราวระหว่างไป-กลับ Google (10 นาที) ─────────────────────

export const OAUTH_COOKIE = "g_oauth";
export const OAUTH_COOKIE_PATH = "/api/auth/google";
export type OAuthPending = { s: string; v: string; n: string | null };

/** เก็บ state + verifier + หน้าที่จะกลับไป ไว้ใน cookie httpOnly (ฝั่งเบราว์เซอร์อ่านไม่ได้) */
export function encodePending(p: OAuthPending): string {
  return Buffer.from(JSON.stringify(p)).toString("base64url");
}

/** อ่าน cookie กลับ — รูปแบบผิดคืน null */
export function decodePending(raw: string | undefined): OAuthPending | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof p?.s !== "string" || typeof p?.v !== "string") return null;
    return { s: p.s, v: p.v, n: typeof p.n === "string" ? p.n : null };
  } catch {
    return null;
  }
}
