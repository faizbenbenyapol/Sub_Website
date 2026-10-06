import { describe, expect, it } from "vitest";
import { escapeHtml, reminderEmail, testSummaryEmail } from "../email-templates";

const base = {
  serviceName: "Netflix",
  amount: 419,
  date: "2026-10-09",
  today: "2026-10-06",
  manageUrl: "http://localhost:3000/services/netflix#cancel",
  settingsUrl: "http://localhost:3000/settings",
};

describe("E1-6 อีเมลเตือนก่อนตัดเงิน", () => {
  it("หัวเรื่องบอกเวลาที่เหลือ ชื่อบริการ และยอด", () => {
    expect(reminderEmail({ ...base, kind: "billing" }).subject).toBe("อีก 3 วัน Netflix จะตัดเงิน ฿419");
  });

  it("เนื้อหามียอด วันที่แบบไทย และลิงก์ไปหน้าวิธียกเลิก", () => {
    const mail = reminderEmail({ ...base, kind: "billing" });
    expect(mail.html).toContain("฿419.00");
    expect(mail.html).toContain("ศุกร์ 9 ตุลาคม 2569");
    expect(mail.html).toContain('href="http://localhost:3000/services/netflix#cancel"');
    expect(mail.text).toContain("ดูวิธียกเลิก: http://localhost:3000/services/netflix#cancel");
  });

  it("E2-1 อีเมลหมดทดลองใช้มีข้อความชวนยกเลิก", () => {
    const mail = reminderEmail({ ...base, kind: "trial_end", date: "2026-10-06" });
    expect(mail.subject).toBe("วันนี้ Netflix หมดช่วงทดลองใช้ฟรี — จะเริ่มเก็บเงิน ฿419");
    expect(mail.html).toContain("จะเริ่มเก็บเงินแล้ว ยกเลิกตอนนี้ถ้าไม่ใช้ต่อ");
    expect(mail.text.match(/จะเริ่มเก็บเงินแล้ว/g)).toHaveLength(1);
  });

  it("ชื่อที่ผู้ใช้พิมพ์เองถูก escape ก่อนใส่ HTML", () => {
    const mail = reminderEmail({ ...base, kind: "billing", serviceName: "<script>x</script>" });
    expect(mail.html).not.toContain("<script>");
    expect(escapeHtml(`a&<>"'`)).toBe("a&amp;&lt;&gt;&quot;&#39;");
  });
});

describe("E4-1 อีเมลทดสอบ", () => {
  it("ไม่มีรายการก็ยังส่งได้ พร้อมข้อความบอก", () => {
    const mail = testSummaryEmail({
      today: base.today,
      items: [],
      appUrl: "http://x",
      settingsUrl: "http://x/settings",
    });
    expect(mail.subject).toBe("อีเมลทดสอบ: ยังไม่มีรายการที่จะตัดเงินใน 30 วัน");
  });

  it("มีรายการแสดงครบทุกตัว", () => {
    const mail = testSummaryEmail({
      today: base.today,
      items: [
        { name: "Netflix", amount: 419, date: "2026-10-09", kind: "billing" },
        { name: "YouTube", amount: 199, date: "2026-10-11", kind: "trial_end" },
      ],
      appUrl: "http://x",
      settingsUrl: "http://x/settings",
    });
    expect(mail.subject).toBe("อีเมลทดสอบ: 2 รายการจะตัดเงินใน 30 วันข้างหน้า");
    expect(mail.text).toContain("Netflix ฿419.00 ศ. 9 ต.ค. (อีก 3 วัน)");
    expect(mail.text).toContain("YouTube หมดช่วงทดลองใช้ ฿199.00");
  });
});
