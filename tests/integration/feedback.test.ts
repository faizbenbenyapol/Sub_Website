import { describe, expect, it } from "vitest";
import { GET as adminList } from "@/app/api/admin/feedback/route";
import { PATCH as adminPatch } from "@/app/api/admin/feedback/[id]/route";
import { POST as send } from "@/app/api/feedback/route";
import { listMyFeedback } from "@/server/services/feedback";
import { call, makeAdmin, makeUser } from "./helpers";

// แจ้งปัญหา / คำแนะนำ: ผู้ใช้ส่งจากหน้าตั้งค่า → admin เห็นในหลังบ้านและเปลี่ยนสถานะ → ผู้ใช้เห็นสถานะ

const params = (id: number) => ({ params: { id: String(id) } });

describe("แจ้งปัญหา / คำแนะนำถึงผู้พัฒนา", () => {
  it("ผู้ใช้ส่ง → admin เห็นพร้อมชื่อผู้ส่งในแท็บใหม่ → ตั้งเป็นแก้แล้ว → ผู้ใช้เห็นสถานะ", async () => {
    const u = await makeUser({ name: "ผู้ทดสอบส่งความเห็น" });
    const admin = await makeAdmin();

    const sent = await call(send, "/api/feedback", {
      method: "POST",
      as: u,
      body: { kind: "bug", message: "  กดบันทึกรายการแล้วหน้าค้าง  " },
    });
    expect(sent.status).toBe(201);
    expect(sent.json.data).toMatchObject({
      kind: "bug",
      message: "กดบันทึกรายการแล้วหน้าค้าง",
      status: "new",
    });
    const id = sent.json.data.id;

    const list = await call(adminList, "/api/admin/feedback?status=new", { as: admin });
    expect(list.status).toBe(200);
    const mine = list.json.data.find((f: { id: number }) => f.id === id);
    expect(mine.user).toEqual({ id: u.id, name: "ผู้ทดสอบส่งความเห็น", email: u.email });

    const patched = await call(adminPatch, `/api/admin/feedback/${id}`, {
      method: "PATCH",
      as: admin,
      body: { status: "resolved" },
      ...params(id),
    });
    expect(patched.status).toBe(200);
    // ตั้งค่าเดิมซ้ำต้องไม่กลายเป็น 404
    const again = await call(adminPatch, `/api/admin/feedback/${id}`, {
      method: "PATCH",
      as: admin,
      body: { status: "resolved" },
      ...params(id),
    });
    expect(again.status).toBe(200);

    const newOnly = await call(adminList, "/api/admin/feedback?status=new", { as: admin });
    expect(newOnly.json.data.some((f: { id: number }) => f.id === id)).toBe(false);
    expect((await listMyFeedback(u.id))[0]).toMatchObject({ id, status: "resolved" });
  });

  it("ข้อความสั้นเกิน / ประเภทผิด → 400 ที่ช่องนั้น · ส่งเกิน 5 ครั้งต่อชั่วโมง → 429", async () => {
    const u = await makeUser();
    const short = await call(send, "/api/feedback", {
      method: "POST",
      as: u,
      body: { kind: "bug", message: "สั้น" },
    });
    expect(short.status).toBe(400);
    expect(short.json.error.fields.message).toBeDefined();
    const badKind = await call(send, "/api/feedback", {
      method: "POST",
      as: u,
      body: { kind: "spam", message: "ข้อความยาวพอสมควรแล้ว" },
    });
    expect(badKind.json.error.fields.kind).toBeDefined();

    const body = { kind: "suggestion", message: "อยากให้มีโหมดสว่างด้วย" };
    for (let i = 0; i < 5; i++) {
      expect((await call(send, "/api/feedback", { method: "POST", as: u, body })).status).toBe(201);
    }
    expect((await call(send, "/api/feedback", { method: "POST", as: u, body })).status).toBe(429);
  });

  it("ผู้ใช้ทั่วไปเปิดรายการของ admin ไม่ได้ (403) · id ที่ไม่มี → 404", async () => {
    const u = await makeUser();
    const admin = await makeAdmin();
    expect((await call(adminList, "/api/admin/feedback", { as: u })).status).toBe(403);
    const missing = await call(adminPatch, "/api/admin/feedback/999999", {
      method: "PATCH",
      as: admin,
      body: { status: "read" },
      ...params(999999),
    });
    expect(missing.status).toBe(404);
  });
});

describe("admin ตอบกลับข้อความ", () => {
  it("ตอบ → ผู้ใช้เห็นคำตอบ สถานะเลื่อนจากใหม่เป็นอ่านแล้ว และได้แจ้งเตือนที่กระดิ่ง · ตอบซ้ำทับคำตอบเดิม", async () => {
    const { listNotifications } = await import("@/server/services/notifications");
    const u = await makeUser();
    const admin = await makeAdmin();
    const sent = await call(send, "/api/feedback", {
      method: "POST",
      as: u,
      body: { kind: "bug", message: "ปฏิทินแสดงวันผิดเดือน" },
    });
    const id = sent.json.data.id;

    const r = await call(adminPatch, `/api/admin/feedback/${id}`, {
      method: "PATCH",
      as: admin,
      body: { reply: "  ขอบคุณครับ แก้ให้แล้ว  " },
      ...params(id),
    });
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({ status: "read", reply: "ขอบคุณครับ แก้ให้แล้ว" });
    expect(r.json.data.repliedAt).toEqual(expect.any(String));

    const [mine] = await listMyFeedback(u.id);
    expect(mine).toMatchObject({ id, reply: "ขอบคุณครับ แก้ให้แล้ว", status: "read" });
    const bell = await listNotifications(u.id, { unreadOnly: true });
    expect(bell.unreadCount).toBe(1);
    expect(bell.data[0]).toMatchObject({ type: "feedback_reply", link: "/settings#feedback-heading" });

    // ตอบซ้ำพร้อมติ๊กแก้แล้ว: คำตอบใหม่ทับของเดิม สถานะไม่ถอยกลับ
    await call(adminPatch, `/api/admin/feedback/${id}`, {
      method: "PATCH",
      as: admin,
      body: { reply: "ออกเวอร์ชันใหม่แล้ว", status: "resolved" },
      ...params(id),
    });
    expect((await listMyFeedback(u.id))[0]).toMatchObject({
      reply: "ออกเวอร์ชันใหม่แล้ว",
      status: "resolved",
    });
  });

  it("body ว่าง หรือคำตอบมีแต่ช่องว่าง → 400 และไม่สร้างแจ้งเตือน", async () => {
    const { listNotifications } = await import("@/server/services/notifications");
    const u = await makeUser();
    const admin = await makeAdmin();
    const id = (
      await call(send, "/api/feedback", {
        method: "POST",
        as: u,
        body: { kind: "other", message: "ทดสอบข้อความยาวพอ" },
      })
    ).json.data.id;
    for (const body of [{}, { reply: "   " }]) {
      const r = await call(adminPatch, `/api/admin/feedback/${id}`, {
        method: "PATCH",
        as: admin,
        body,
        ...params(id),
      });
      expect(r.status).toBe(400);
    }
    expect((await listNotifications(u.id, {})).data).toHaveLength(0);
  });
});

describe("ความคืบหน้า 3 ขั้น", () => {
  it("รับเรื่อง → กำลังแก้ไข → แก้ไขเรียบร้อย: แจ้งเตือนทุกครั้งที่ขยับขั้น · ตั้งขั้นเดิมซ้ำ/เป็นอ่านแล้ว ไม่แจ้ง · ?status= กรองได้หลายค่า", async () => {
    const { listNotifications } = await import("@/server/services/notifications");
    const u = await makeUser();
    const admin = await makeAdmin();
    const id = (
      await call(send, "/api/feedback", {
        method: "POST",
        as: u,
        body: { kind: "bug", message: "ปุ่มบันทึกกดไม่ได้บนมือถือ" },
      })
    ).json.data.id;
    const setStatus = (status: string) =>
      call(adminPatch, `/api/admin/feedback/${id}`, {
        method: "PATCH",
        as: admin,
        body: { status },
        ...params(id),
      });

    for (const s of ["acknowledged", "in_progress", "in_progress", "resolved", "read"]) {
      expect((await setStatus(s)).status).toBe(200);
    }
    const titles = (await listNotifications(u.id, {})).data.map((n) => n.title).reverse();
    expect(titles).toEqual([
      "ทีมพัฒนาอัปเดตเรื่องที่คุณแจ้ง: รับเรื่อง",
      "ทีมพัฒนาอัปเดตเรื่องที่คุณแจ้ง: กำลังแก้ไข",
      "ทีมพัฒนาอัปเดตเรื่องที่คุณแจ้ง: แก้ไขเรียบร้อย",
    ]);

    await setStatus("in_progress");
    const doing = await call(adminList, "/api/admin/feedback?status=acknowledged,in_progress", { as: admin });
    expect(doing.json.data.map((f: { id: number }) => f.id)).toContain(id);
    const done = await call(adminList, "/api/admin/feedback?status=resolved", { as: admin });
    expect(done.json.data.map((f: { id: number }) => f.id)).not.toContain(id);
  });
});
