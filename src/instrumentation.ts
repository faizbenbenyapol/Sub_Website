// ตั้งงานแจ้งเตือนรายวัน 08:00 เวลาไทย (docs/02 ข้อ 6, ADR-004)
// งานจริงอยู่ที่ POST /api/cron/reminders — ที่นี่แค่ "กดเรียก" endpoint นั้นตามเวลา
// จึงไม่ต้อง import โค้ดฝั่ง DB (ที่เป็น server-only) เข้ามาใน instrumentation และสลับไปใช้ scheduler ภายนอกได้ทันที

const globalForCron = globalThis as unknown as { reminderCronStarted?: boolean };

/** เรียก endpoint งานแจ้งเตือนของเซิร์ฟเวอร์ตัวเอง */
async function triggerReminders(reason: string) {
  const url = `${process.env.APP_URL ?? "http://localhost:3000"}/api/cron/reminders`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const body = await res.json().catch(() => null);
    console.info(`[cron] ${reason}: ${res.status}`, body?.data ?? body?.error ?? "");
  } catch (err) {
    console.error(`[cron] ${reason}: เรียก ${url} ไม่สำเร็จ`, err);
  }
}

/** Next เรียกครั้งเดียวตอนเซิร์ฟเวอร์เริ่ม — ต้องจบเร็ว จึงตั้งเวลาไว้แล้วกลับทันที */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.CRON_ENABLED !== "true") return;
  if (globalForCron.reminderCronStarted) return;
  globalForCron.reminderCronStarted = true;

  const { schedule } = await import("node-cron");
  schedule("0 8 * * *", () => triggerReminders("08:00"), {
    timezone: "Asia/Bangkok",
    name: "daily-reminders",
    noOverlap: true,
  });
  // รันหนึ่งรอบหลังเซิร์ฟเวอร์พร้อม เพื่อตามงานที่พลาดตอนเครื่องปิด (เลื่อนวันตัดเงิน + ส่งที่ค้าง)
  setTimeout(() => triggerReminders("startup"), 15_000);
  console.info("[cron] ตั้งงานแจ้งเตือนทุกวัน 08:00 (Asia/Bangkok) แล้ว");
}
