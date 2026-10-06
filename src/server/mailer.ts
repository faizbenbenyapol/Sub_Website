import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";

// ตัวส่งอีเมล — MAIL_TRANSPORT=smtp ส่งผ่าน Gmail จริง, console พิมพ์ลง log (ใช้ตอนพัฒนา/เทส)

export type Mail = { to: string; subject: string; html: string; text: string };

const globalForMail = globalThis as unknown as { mailTransport?: Transporter };

/** สร้าง transport ครั้งเดียวแล้วใช้ซ้ำ (Gmail: พอร์ต 465 ใช้ TLS ตั้งแต่ต้น) */
function transport(): Transporter {
  globalForMail.mailTransport ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return globalForMail.mailTransport;
}

/** ส่งอีเมลหนึ่งฉบับ — โยน error ถ้าส่งไม่สำเร็จ ให้ผู้เรียกบันทึกสถานะ failed */
export async function sendMail(mail: Mail): Promise<void> {
  if (env.MAIL_TRANSPORT === "console") {
    console.info(`[mail:console] ถึง ${mail.to} · ${mail.subject}\n${mail.text}\n`);
    return;
  }
  await transport().sendMail({
    from: env.MAIL_FROM ?? env.SMTP_USER,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
}
