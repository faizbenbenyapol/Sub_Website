// ตรวจ responsive ทุกหน้าทุกขนาดจอกับ dev server ที่รันอยู่ (ไม่ใช่เทสอัตโนมัติ — สคริปต์ช่วยตรวจด้วยตาก่อนส่งงาน)
// ใช้: node scripts/audit-responsive.mjs [BASE_URL] [OUT_DIR]
// ต้องเปิด DEMO_LOGIN=true และตั้ง AUDIT_ADMIN_EMAIL / AUDIT_ADMIN_PASSWORD (env) เพื่อตรวจหน้าหลังบ้าน
// ผล: รายการปัญหา (เลื่อนแนวนอน, ล้นขอบจอ, ข้อความถูกตัด) + ภาพหน้าจอเต็มหน้าใน OUT_DIR
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = process.argv[3] ?? "audit-shots";
const WIDTHS = [360, 393, 768, 1024, 1280, 1440];
const SHOT_WIDTHS = new Set([393, 1440]); // เก็บภาพเฉพาะมือถือกับจอใหญ่ ไม่ให้ภาพเยอะเกิน

mkdirSync(OUT, { recursive: true });

/** วัดในหน้า: เลื่อนแนวนอน, element ที่ล้นขอบขวาจอ, ข้อความที่ถูกตัด (ellipsis/line-clamp/overflow hidden) */
function measure() {
  const vw = document.documentElement.clientWidth;
  const out = { overflowX: document.documentElement.scrollWidth - vw, offscreen: [], truncated: [] };
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (
      cs.display === "none" ||
      cs.visibility === "hidden" ||
      el.closest("dialog:not([open]),[popover]:not(:popover-open)")
    )
      continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    // ข้ามสิ่งที่อยู่ในกล่องเลื่อนแนวนอนโดยตั้งใจ (แท็บหมวด, ตาราง admin)
    const scroller = el.closest("[class*='overflow-x-auto']");
    // ข้ามของตกแต่งที่ถูกกล่อง overflow-hidden ตัดอยู่แล้ว (วงกลมบนบล็อกสีน้ำเงิน)
    const clipped =
      el.closest("[class*='overflow-hidden']") && el.closest("[class*='overflow-hidden']") !== el;
    if (r.right > vw + 1 && !scroller && !clipped && cs.position !== "fixed") {
      out.offscreen.push(
        `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} right=${Math.round(r.right)}`,
      );
    }
    const text = el.textContent?.trim() ?? "";
    // ข้อความที่ถูกตัดจริง (… หรือ line-clamp) — ข้าม sr-only (กว้าง 1px ตั้งใจซ่อนจากตา)
    const clips = cs.textOverflow === "ellipsis" || cs.webkitLineClamp !== "none";
    if (
      clips &&
      text &&
      el.clientWidth > 1 &&
      (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2)
    ) {
      out.truncated.push(text.slice(0, 50));
    }
  }
  out.offscreen = [...new Set(out.offscreen)].slice(0, 8);
  out.truncated = [...new Set(out.truncated)].slice(0, 12);
  return out;
}

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "msedge" });

/** ล็อกอินใน context ด้วย API (cookie ติด context) */
async function signIn(ctx, kind) {
  const headers = { origin: BASE };
  if (kind === "demo") return ctx.request.post(`${BASE}/api/auth/demo`, { headers });
  if (kind === "admin")
    return ctx.request.post(`${BASE}/api/auth/login`, {
      headers,
      data: { email: process.env.AUDIT_ADMIN_EMAIL, password: process.env.AUDIT_ADMIN_PASSWORD },
    });
}

/** หา id ที่ใช้ในหน้า detail จาก API ของบัญชีที่ล็อกอินอยู่ */
async function ids(ctx) {
  const subs = (await (await ctx.request.get(`${BASE}/api/subscriptions`)).json()).data ?? [];
  const groups = (await (await ctx.request.get(`${BASE}/api/groups`)).json()).data ?? [];
  return { sub: subs[0]?.id, group: groups[0]?.id };
}

const sets = [
  { kind: null, pages: ["/", "/login", "/register", "/services", "/services/netflix"] },
  {
    kind: "demo",
    pages: async (c) => {
      const { sub, group } = await ids(c);
      return [
        "/",
        "/dashboard",
        "/subscriptions",
        "/subscriptions?status=cancelled",
        "/subscriptions/new",
        ...(sub ? [`/subscriptions/${sub}/edit`] : []),
        "/calendar",
        "/groups",
        "/groups/new",
        ...(group ? [`/groups/${group}`] : []),
        "/services",
        "/services/claude",
        "/settings",
        "/notifications",
        "/report",
      ];
    },
  },
  {
    kind: "admin",
    pages: [
      "/admin",
      "/admin/categories",
      "/admin/services",
      "/admin/services/new",
      "/admin/users",
      "/admin/feedback?tab=all",
    ],
  },
];

let problems = 0;
for (const set of sets) {
  const ctx = await browser.newContext({ locale: "th-TH", timezoneId: "Asia/Bangkok" });
  if (set.kind) await signIn(ctx, set.kind);
  const pages = typeof set.pages === "function" ? await set.pages(ctx) : set.pages;
  const page = await ctx.newPage();
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: w < 768 ? 852 : 900 });
    for (const p of pages) {
      await page.goto(`${BASE}${p}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const m = await page.evaluate(measure);
      const bad = m.overflowX > 0 || m.offscreen.length > 0;
      if (bad || m.truncated.length) {
        if (bad) problems++;
        console.log(`[${set.kind ?? "public"}] ${w}px ${p}`, JSON.stringify(m));
      }
      if (SHOT_WIDTHS.has(w)) {
        const name = `${set.kind ?? "public"}_${w}_${p.replace(/[^a-z0-9]+/gi, "_")}.png`;
        await page.screenshot({ path: `${OUT}/${name}`, fullPage: true });
      }
    }
  }
  await ctx.close();
}
await browser.close();
console.log(problems ? `พบ ${problems} หน้าที่ล้นจอ` : "ไม่มีหน้าไหนเลื่อนแนวนอนหรือล้นขอบจอ");
