import { formatThaiDate, relativeDayLabel } from "./dates";
import { formatBaht } from "./money";

// เนื้อหาอีเมล (docs/03 ข้อ 10): ตาราง HTML พื้นมืด ฟอนต์ระบบ เนื้อหาเป็น "สลิป" — ไม่มี glass/ฟอนต์เว็บเพราะอีเมลไม่รองรับ
// pure function ทั้งไฟล์ จึง unit test ได้ (E1-6)

export type ReminderInput = {
  kind: "billing" | "trial_end";
  serviceName: string;
  amount: number;
  date: string; // YYYY-MM-DD
  today: string;
  manageUrl: string; // หน้าวิธียกเลิก (#cancel) หรือหน้าแก้รายการสำหรับ custom
  settingsUrl: string;
};

export type EmailContent = { subject: string; html: string; text: string; title: string; body: string };

/** กัน HTML injection จากชื่อที่ผู้ใช้พิมพ์เอง */
export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

const COLORS = {
  night: "#0B0B0F",
  card: "#18181C",
  text: "#F4F4F6",
  muted: "#A6A6B0",
  due: "#FF8A3D",
  paid: "#C8F169",
  line: "#2E2E36",
};

/** โครงอีเมลร่วม: หัว "ตัดยัง?" + เนื้อหา + ท้ายอีเมลบอกวิธีปิดการแจ้งเตือน */
function layout(inner: string, settingsUrl: string): string {
  return `<!doctype html><html lang="th"><body style="margin:0;background:${COLORS.night};font-family:Tahoma,'Segoe UI',sans-serif;color:${COLORS.text}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.night}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="font-size:20px;font-weight:bold;padding:0 4px 16px">ตัดยัง?</td></tr>
${inner}
<tr><td style="padding:20px 4px 0;font-size:13px;line-height:1.7;color:${COLORS.muted}">ปิดการแจ้งเตือนหรือเปลี่ยนจำนวนวันล่วงหน้าได้ที่ <a href="${settingsUrl}" style="color:${COLORS.paid}">หน้าตั้งค่า</a></td></tr>
</table></td></tr></table></body></html>`;
}

/** แถวสลิปหนึ่งรายการ: ชื่อซ้าย · วัน+ยอดขวา คั่นด้วยเส้นปรุ */
function slipRow(
  name: string,
  rightTop: string,
  amount: string,
  rightBottom: string,
  accent: string,
): string {
  return `<tr><td style="padding:0 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.card};border-radius:16px">
<tr><td style="padding:16px 18px;font-size:17px;font-weight:bold">${name}</td>
<td style="padding:16px 18px;border-left:2px dashed ${COLORS.line};text-align:right;white-space:nowrap">
<div style="font-size:14px;font-weight:bold;color:${accent}">${rightTop}</div>
<div style="font-family:'Courier New',monospace;font-size:20px;font-weight:bold">${amount}</div>
<div style="font-size:13px;color:${COLORS.muted}">${rightBottom}</div></td></tr></table></td></tr>`;
}

/** อีเมลเตือนก่อนตัดเงิน / ก่อนหมดทดลองใช้ฟรี (US-E1, E2) */
export function reminderEmail(r: ReminderInput): EmailContent {
  const when = relativeDayLabel(r.today, r.date);
  const amount = formatBaht(r.amount);
  const longDate = formatThaiDate(r.date, "long");
  const name = escapeHtml(r.serviceName);
  const isTrial = r.kind === "trial_end";

  const short = formatBaht(r.amount, { short: true });
  // หัวเรื่องขึ้นต้นด้วยเวลาที่เหลือ ตามตัวอย่างใน docs/03 ข้อ 10: "อีก 3 วัน Netflix จะตัดเงิน ฿419"
  const title = isTrial
    ? `${when} ${r.serviceName} หมดช่วงทดลองใช้ฟรี`
    : `${when} ${r.serviceName} จะตัดเงิน`;
  const subject = isTrial ? `${title} — จะเริ่มเก็บเงิน ${short}` : `${title} ${short}`;
  const lead = isTrial
    ? "จะเริ่มเก็บเงินแล้ว ยกเลิกตอนนี้ถ้าไม่ใช้ต่อ"
    : "ถ้ายังใช้อยู่ไม่ต้องทำอะไร ถ้าเลิกใช้แล้ว ยกเลิกก่อนวันตัดเงิน";
  const body = `${amount} · ${longDate}${isTrial ? " · จะเริ่มเก็บเงินแล้ว ยกเลิกตอนนี้ถ้าไม่ใช้ต่อ" : ""}`;

  const html = layout(
    `<tr><td style="padding:0 4px 14px;font-size:15px;line-height:1.7;color:${COLORS.muted}">${lead}</td></tr>
${slipRow(name, when, amount, longDate, COLORS.due)}
<tr><td style="padding:8px 0 0"><a href="${r.manageUrl}" style="display:inline-block;background:${COLORS.paid};color:${COLORS.night};font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:12px">ดูวิธียกเลิก</a></td></tr>`,
    r.settingsUrl,
  );
  const text = `${title}\n${amount} · ${longDate}\n${lead}\nดูวิธียกเลิก: ${r.manageUrl}\nปิดการแจ้งเตือน: ${r.settingsUrl}`;
  return { subject, html, text, title, body };
}

/** อีเมลทดสอบ (US-E4): สรุปรายการใน 30 วันข้างหน้า */
export function testSummaryEmail(input: {
  today: string;
  items: { name: string; amount: number; date: string; kind: "billing" | "trial_end" }[];
  appUrl: string;
  settingsUrl: string;
}): EmailContent {
  const { today, items } = input;
  const subject = items.length
    ? `อีเมลทดสอบ: ${items.length} รายการจะตัดเงินใน 30 วันข้างหน้า`
    : "อีเมลทดสอบ: ยังไม่มีรายการที่จะตัดเงินใน 30 วัน";
  const rows = items
    .map((i) =>
      slipRow(
        escapeHtml(i.name),
        i.kind === "trial_end"
          ? `หมดทดลอง · ${relativeDayLabel(today, i.date)}`
          : relativeDayLabel(today, i.date),
        formatBaht(i.amount),
        formatThaiDate(i.date),
        i.kind === "trial_end" ? COLORS.due : COLORS.text,
      ),
    )
    .join("\n");
  const html = layout(
    `<tr><td style="padding:0 4px 14px;font-size:15px;line-height:1.7;color:${COLORS.muted}">นี่คืออีเมลทดสอบจากหน้าตั้งค่า อีเมลแจ้งเตือนจริงจะส่งทุกวันตอน 08:00</td></tr>
${rows || `<tr><td style="padding:0 4px 14px">ยังไม่มีรายการที่จะตัดเงินใน 30 วัน</td></tr>`}
<tr><td style="padding:8px 0 0"><a href="${input.appUrl}/dashboard" style="display:inline-block;background:${COLORS.paid};color:${COLORS.night};font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:12px">เปิดหน้าภาพรวม</a></td></tr>`,
    input.settingsUrl,
  );
  const text = [
    subject,
    ...items.map(
      (i) =>
        `- ${i.name}${i.kind === "trial_end" ? " หมดช่วงทดลองใช้" : ""} ${formatBaht(i.amount)} ${formatThaiDate(i.date)} (${relativeDayLabel(today, i.date)})`,
    ),
  ].join("\n");
  return { subject, html, text, title: "ส่งอีเมลทดสอบแล้ว", body: subject };
}
