import type { NextConfig } from "next";

// security headers ทุกหน้า — กัน clickjacking (iframe), MIME sniffing และไม่ส่ง URL เต็มไปเว็บอื่น
// ยังไม่ใส่ CSP แบบ script-src เพราะต้องใช้ nonce ซึ่งบังคับทุกหน้าเป็น dynamic (docs: guides/content-security-policy)
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS เฉพาะเมื่อ deploy บน HTTPS — ถ้าใส่ตอน demo ผ่าน http://IP ในวง LAN เบราว์เซอร์จะจำผิด
  ...(process.env.APP_URL?.startsWith("https://")
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
