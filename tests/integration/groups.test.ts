import { describe, expect, it, vi } from "vitest";
import { POST as remind } from "@/app/api/groups/[id]/members/[memberId]/remind/route";
import { DELETE as removeMember } from "@/app/api/groups/[id]/members/[memberId]/route";
import { POST as addMember } from "@/app/api/groups/[id]/members/route";
import { PUT as setPayment } from "@/app/api/groups/[id]/payments/route";
import { DELETE as delGroup, GET as getGroup, PATCH as patchGroup } from "@/app/api/groups/[id]/route";
import { GET as listGroups, POST as createGroup } from "@/app/api/groups/route";
import { GET as savings } from "@/app/api/savings/route";
import { currentPeriod, getPayPage } from "@/server/services/groups";
import { call, makeCatalog, makeSub, makeUser } from "./helpers";

// F. หารค่าบริการ + G. ตัวช่วยประหยัด (P1, docs/04-test-plan.md)

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/server/mailer", () => ({ sendMail }));

const PROMPTPAY = "0812345678";

/** เจ้าของ + รายการรายเดือน ฿419 */
async function setup(price = "419.00") {
  const owner = await makeUser({ name: "มายด์" });
  const c = await makeCatalog({ serviceName: "Netflix" });
  const subId = await makeSub(owner.id, { planId: c.monthlyPlanId, price });
  return { owner, c, subId };
}

const members = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ name: `เพื่อน ${i + 1}`, email: `f${i}@x.com` }));

async function create(owner: { id: number; role: "user" | "admin" }, body: Record<string, unknown>) {
  return call(createGroup, "/api/groups", { method: "POST", as: owner, body });
}

const tokenOf = (payUrl: string) => payUrl.split("/pay/")[1];

describe("US-F1 สร้างกลุ่มหาร", () => {
  it("F1-1 / F1-4 หารเท่ากัน 3 คน (+เจ้าของ) → คนละ 104.75 และ response มีแต่ PromptPay แบบ mask", async () => {
    const { owner, subId } = await setup();
    const r = await create(owner, {
      subscriptionId: subId,
      promptpayId: PROMPTPAY,
      splitMode: "equal",
      members: members(3),
    });
    expect(r.status).toBe(201);
    expect(r.json.data).toMatchObject({
      name: "หาร Netflix",
      total: 419,
      ownerAmount: 104.75,
      memberCount: 3,
    });
    expect(r.json.data.members.map((m: { amount: number }) => m.amount)).toEqual([104.75, 104.75, 104.75]);
    expect(r.json.data.promptpayIdMasked).toBe("08x-xxx-5678");
    expect(JSON.stringify(r.json)).not.toContain(PROMPTPAY);
    for (const m of r.json.data.members) expect(tokenOf(m.payUrl)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("F1-2 custom ผลรวมเกินราคา / สมาชิก 0 หรือ 11 คน / PromptPay ผิด → 400", async () => {
    const { owner, subId } = await setup();
    const base = { subscriptionId: subId, promptpayId: PROMPTPAY, splitMode: "custom" };
    const over = await create(owner, {
      ...base,
      members: [
        { name: "ก", amount: 300 },
        { name: "ข", amount: 200 },
      ],
    });
    expect(over.status).toBe(400);
    expect((await create(owner, { ...base, members: [] })).status).toBe(400);
    expect((await create(owner, { ...base, splitMode: "equal", members: members(11) })).status).toBe(400);
    const badId = await create(owner, {
      ...base,
      splitMode: "equal",
      promptpayId: "0212345678",
      members: members(1),
    });
    expect(badId.json.error.fields).toHaveProperty("promptpayId");
  });

  it("F1-3 รายการเดิมสร้างซ้ำ → 409 GROUP_EXISTS", async () => {
    const { owner, subId } = await setup();
    const body = { subscriptionId: subId, promptpayId: PROMPTPAY, splitMode: "equal", members: members(1) };
    expect((await create(owner, body)).status).toBe(201);
    const again = await create(owner, body);
    expect(again.status).toBe(409);
    expect(again.json.error.code).toBe("GROUP_EXISTS");
  });

  it("หารรายการรายปี / ที่ยกเลิกแล้ว / ของคนอื่นไม่ได้", async () => {
    const { owner, c } = await setup();
    const other = await makeUser();
    const yearly = await makeSub(owner.id, {
      planId: c.yearlyPlanId,
      billingCycle: "yearly",
      price: "4190.00",
    });
    const cancelled = await makeSub(owner.id, { planId: c.monthlyPlanId, status: "cancelled" });
    const others = await makeSub(other.id, { planId: c.monthlyPlanId });
    const body = { promptpayId: PROMPTPAY, splitMode: "equal", members: members(1) };
    expect((await create(owner, { ...body, subscriptionId: yearly })).status).toBe(400);
    expect((await create(owner, { ...body, subscriptionId: cancelled })).status).toBe(400);
    expect((await create(owner, { ...body, subscriptionId: others })).status).toBe(404);
  });
});

describe("แก้กลุ่ม / สมาชิก", () => {
  it("หารเท่ากัน: เพิ่ม/ลบสมาชิกแล้วคำนวณใหม่ · ฿100 หาร 3 เศษตกเจ้าของ (U-S2)", async () => {
    const { owner, subId } = await setup("100.00");
    const g = (
      await create(owner, {
        subscriptionId: subId,
        promptpayId: PROMPTPAY,
        splitMode: "equal",
        members: members(1),
      })
    ).json.data;
    const params = { id: String(g.id) };
    const added = await call(addMember, "/x", { method: "POST", as: owner, params, body: { name: "ใหม่" } });
    expect(added.json.data.members.map((m: { amount: number }) => m.amount)).toEqual([33.33, 33.33]);
    expect(added.json.data.ownerAmount).toBe(33.34);

    const removed = await call(removeMember, "/x", {
      method: "DELETE",
      as: owner,
      params: { ...params, memberId: String(added.json.data.members[1].id) },
    });
    expect(removed.json.data.members.map((m: { amount: number }) => m.amount)).toEqual([50]);
    expect(removed.json.data.ownerAmount).toBe(50);
  });

  it("F2-2 ลบสมาชิก → ลิงก์จ่ายเดิมใช้ไม่ได้ทันที · token มั่ว → null", async () => {
    const { owner, subId } = await setup();
    const g = (
      await create(owner, {
        subscriptionId: subId,
        promptpayId: PROMPTPAY,
        splitMode: "equal",
        members: members(2),
      })
    ).json.data;
    const [first, second] = g.members;
    expect(await getPayPage(tokenOf(first.payUrl))).toMatchObject({ memberName: "เพื่อน 1", amount: 139.66 });
    await call(removeMember, "/x", {
      method: "DELETE",
      as: owner,
      params: { id: String(g.id), memberId: String(first.id) },
    });
    expect(await getPayPage(tokenOf(first.payUrl))).toBeNull();
    expect(await getPayPage(tokenOf(second.payUrl))).not.toBeNull();
    expect(await getPayPage("x".repeat(43))).toBeNull();
    expect(await getPayPage("' or 1=1 --")).toBeNull();
  });

  it("F2-3 หน้าจ่ายไม่มีข้อมูลสมาชิกคนอื่นและ PromptPay เต็ม (เลขอยู่ใน payload QR เท่านั้น)", async () => {
    const { owner, subId } = await setup();
    const g = (
      await create(owner, {
        subscriptionId: subId,
        promptpayId: PROMPTPAY,
        splitMode: "equal",
        members: members(2),
      })
    ).json.data;
    const page = await getPayPage(tokenOf(g.members[0].payUrl));
    const { payload, ...visible } = page!;
    expect(payload).toMatch(/^000201/);
    const text = JSON.stringify(visible);
    expect(text).not.toContain("เพื่อน 2");
    expect(text).not.toContain("f1@x.com");
    expect(text).not.toContain(PROMPTPAY);
  });

  it("เปลี่ยน custom → equal คำนวณใหม่ทุกคน", async () => {
    const { owner, subId } = await setup("300.00");
    const g = (
      await create(owner, {
        subscriptionId: subId,
        promptpayId: PROMPTPAY,
        splitMode: "custom",
        members: [
          { name: "ก", amount: 200 },
          { name: "ข", amount: 10 },
        ],
      })
    ).json.data;
    expect(g.ownerAmount).toBe(90);
    const r = await call(patchGroup, "/x", {
      method: "PATCH",
      as: owner,
      params: { id: String(g.id) },
      body: { splitMode: "equal" },
    });
    expect(r.json.data.members.map((m: { amount: number }) => m.amount)).toEqual([100, 100]);
  });
});

describe("US-F3 สถานะการจ่าย + เตือน", () => {
  it("F3-1 กดจ่ายแล้วรายเดือน · เดือนอื่นยังเป็นยังไม่จ่าย · หน้าจ่ายเห็นสถานะ", async () => {
    const { owner, subId } = await setup();
    const g = (
      await create(owner, {
        subscriptionId: subId,
        promptpayId: PROMPTPAY,
        splitMode: "equal",
        members: members(2),
      })
    ).json.data;
    const params = { id: String(g.id) };
    const period = currentPeriod();
    const m = g.members[0];
    const r = await call(setPayment, "/x", {
      method: "PUT",
      as: owner,
      params,
      body: { memberId: m.id, period, status: "paid" },
    });
    expect(r.json.data.paidCount).toBe(1);
    expect((await getPayPage(tokenOf(m.payUrl)))!.status).toBe("paid");

    const other = await call(getGroup, "/api/groups/1?period=2020-01", { as: owner, params });
    expect(other.json.data.paidCount).toBe(0);
    expect((await call(getGroup, "/api/groups/1?period=2020-13", { as: owner, params })).status).toBe(400);

    // upsert: กดกลับเป็นยังไม่จ่าย
    const undo = await call(setPayment, "/x", {
      method: "PUT",
      as: owner,
      params,
      body: { memberId: m.id, period, status: "unpaid" },
    });
    expect(undo.json.data.paidCount).toBe(0);
  });

  it("F3-2 เตือนสมาชิกไม่มีอีเมล → 400 · ซ้ำวันเดียว → 429", async () => {
    const { owner, subId } = await setup();
    const g = (
      await create(owner, {
        subscriptionId: subId,
        promptpayId: PROMPTPAY,
        splitMode: "equal",
        members: [{ name: "มีเมล", email: "a@x.com" }, { name: "ไม่มีเมล" }],
      })
    ).json.data;
    const p = (i: number) => ({ id: String(g.id), memberId: String(g.members[i].id) });
    expect((await call(remind, "/x", { method: "POST", as: owner, params: p(1) })).status).toBe(400);
    expect((await call(remind, "/x", { method: "POST", as: owner, params: p(0) })).status).toBe(204);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "a@x.com" }));
    expect((await call(remind, "/x", { method: "POST", as: owner, params: p(0) })).status).toBe(429);
  });
});

describe("A3-4 กลุ่มของคนอื่น → 404", () => {
  it("GET / PATCH / DELETE / PUT payments / สมาชิก / เตือน", async () => {
    const { owner, subId } = await setup();
    const intruder = await makeUser();
    const g = (
      await create(owner, {
        subscriptionId: subId,
        promptpayId: PROMPTPAY,
        splitMode: "equal",
        members: members(1),
      })
    ).json.data;
    const params = { id: String(g.id) };
    const memberParams = { ...params, memberId: String(g.members[0].id) };
    const results = [
      await call(getGroup, "/x", { as: intruder, params }),
      await call(patchGroup, "/x", { method: "PATCH", as: intruder, params, body: { name: "ของฉัน" } }),
      await call(setPayment, "/x", {
        method: "PUT",
        as: intruder,
        params,
        body: { memberId: g.members[0].id, period: currentPeriod(), status: "paid" },
      }),
      await call(addMember, "/x", { method: "POST", as: intruder, params, body: { name: "แฝง" } }),
      await call(removeMember, "/x", { method: "DELETE", as: intruder, params: memberParams }),
      await call(remind, "/x", { method: "POST", as: intruder, params: memberParams }),
      await call(delGroup, "/x", { method: "DELETE", as: intruder, params }),
    ];
    expect(results.map((r) => r.status)).toEqual([404, 404, 404, 404, 404, 404, 404]);
    expect((await call(listGroups, "/api/groups", { as: intruder })).json.data).toEqual([]);
    const still = await call(getGroup, "/x", { as: owner, params });
    expect(still.json.data).toMatchObject({ name: "หาร Netflix", memberCount: 1, paidCount: 0 });
  });

  it("ใช้ memberId ของกลุ่มอื่น (ของตัวเอง) กับกลุ่มนี้ → 404", async () => {
    const { owner, c, subId } = await setup();
    const sub2 = await makeSub(owner.id, { planId: c.familyPlanId, price: "599.00" });
    const body = { promptpayId: PROMPTPAY, splitMode: "equal", members: members(1) };
    const g1 = (await create(owner, { ...body, subscriptionId: subId })).json.data;
    const g2 = (await create(owner, { ...body, subscriptionId: sub2 })).json.data;
    const r = await call(setPayment, "/x", {
      method: "PUT",
      as: owner,
      params: { id: String(g1.id) },
      body: { memberId: g2.members[0].id, period: currentPeriod(), status: "paid" },
    });
    expect(r.status).toBe(404);
  });
});

describe("G. /api/savings คืนเฉพาะรายการของผู้ใช้คนนั้น", () => {
  it("ผู้ใช้ไม่มีรายการ → [] แม้คนอื่นมีข้อเสนอ", async () => {
    const { owner } = await setup();
    const fresh = await makeUser();
    const mine = await call(savings, "/api/savings", { as: owner });
    expect(mine.json.data.length).toBeGreaterThan(0);
    expect((await call(savings, "/api/savings", { as: fresh })).json.data).toEqual([]);
  });
});

describe("แก้รายการที่มีกลุ่มหารอยู่", () => {
  it("ลดราคา → กลุ่มหารเท่ากันคำนวณยอดใหม่ เจ้าของไม่ติดลบ", async () => {
    const { PATCH } = await import("@/app/api/subscriptions/[id]/route");
    const { owner, subId } = await setup();
    const g = (
      await create(owner, {
        subscriptionId: subId,
        promptpayId: PROMPTPAY,
        splitMode: "equal",
        members: members(3),
      })
    ).json.data;
    const r = await call(PATCH, "/x", {
      method: "PATCH",
      as: owner,
      params: { id: String(subId) },
      body: { price: 299 },
    });
    expect(r.status).toBe(200);
    const after = (await call(getGroup, "/x", { as: owner, params: { id: String(g.id) } })).json.data;
    expect(after.total).toBe(299);
    expect(after.members.map((m: { amount: number }) => m.amount)).toEqual([74.75, 74.75, 74.75]);
    expect(after.ownerAmount).toBe(74.75);
  });
});

describe("แก้รายการที่มีกลุ่มหารแบบกำหนดเอง / เปลี่ยนเป็นรายปี", () => {
  it("ราคาใหม่ต่ำกว่ายอดสมาชิกรวม → 400 ที่ช่อง price · เปลี่ยนเป็นรายปี → 400 · ราคาไม่เปลี่ยน", async () => {
    const { PATCH } = await import("@/app/api/subscriptions/[id]/route");
    const { owner, subId } = await setup();
    await create(owner, {
      subscriptionId: subId,
      promptpayId: PROMPTPAY,
      splitMode: "custom",
      members: [
        { name: "ก", amount: 200 },
        { name: "ข", amount: 100 },
      ],
    });
    const p = { method: "PATCH" as const, as: owner, params: { id: String(subId) } };
    const tooLow = await call(PATCH, "/x", { ...p, body: { price: 250 } });
    expect(tooLow.status).toBe(400);
    expect(tooLow.json.error.fields).toHaveProperty("price");
    const yearly = await call(PATCH, "/x", { ...p, body: { billingCycle: "yearly" } });
    expect(yearly.status).toBe(400);
    expect(yearly.json.error.fields).toHaveProperty("billingCycle");
    const fine = await call(PATCH, "/x", { ...p, body: { price: 300 } });
    expect(fine.json.data.price).toBe(300);
  });
});

describe("รอบ code review / security audit", () => {
  it("ลบสมาชิกแล้วเพิ่มอีเมลเดิมกลับมา → เตือนซ้ำวันเดียวกันไม่ได้", async () => {
    const { owner, subId } = await setup();
    const g = (
      await create(owner, {
        subscriptionId: subId,
        promptpayId: PROMPTPAY,
        splitMode: "equal",
        members: [{ name: "เหยื่อ", email: "victim@x.com" }],
      })
    ).json.data;
    const params = { id: String(g.id) };
    const first = g.members[0];
    expect(
      (
        await call(remind, "/x", {
          method: "POST",
          as: owner,
          params: { ...params, memberId: String(first.id) },
        })
      ).status,
    ).toBe(204);
    await call(removeMember, "/x", {
      method: "DELETE",
      as: owner,
      params: { ...params, memberId: String(first.id) },
    });
    const added = await call(addMember, "/x", {
      method: "POST",
      as: owner,
      params,
      body: { name: "เหยื่อ", email: "victim@x.com" },
    });
    const again = added.json.data.members[0];
    const r = await call(remind, "/x", {
      method: "POST",
      as: owner,
      params: { ...params, memberId: String(again.id) },
    });
    expect(r.status).toBe(429);
  });

  it("ยกเลิกรายการ → หน้าจ่าย closed, เตือนไม่ได้, กลุ่มมีป้าย cancelled", async () => {
    const { PATCH } = await import("@/app/api/subscriptions/[id]/route");
    const { owner, subId } = await setup();
    const g = (
      await create(owner, {
        subscriptionId: subId,
        promptpayId: PROMPTPAY,
        splitMode: "equal",
        members: [{ name: "ก", email: "k@x.com" }],
      })
    ).json.data;
    expect((await getPayPage(tokenOf(g.members[0].payUrl)))!.closed).toBe(false);
    await call(PATCH, "/x", {
      method: "PATCH",
      as: owner,
      params: { id: String(subId) },
      body: { status: "cancelled" },
    });
    expect((await getPayPage(tokenOf(g.members[0].payUrl)))!.closed).toBe(true);
    const r = await call(remind, "/x", {
      method: "POST",
      as: owner,
      params: { id: String(g.id), memberId: String(g.members[0].id) },
    });
    expect(r.status).toBe(400);
    expect(
      (await call(getGroup, "/x", { as: owner, params: { id: String(g.id) } })).json.data.cancelled,
    ).toBe(true);
  });

  it("เพิ่มสมาชิกพร้อมกันเกินเพดาน 10 คนไม่ได้", async () => {
    const { owner, subId } = await setup();
    const g = (
      await create(owner, {
        subscriptionId: subId,
        promptpayId: PROMPTPAY,
        splitMode: "equal",
        members: members(8),
      })
    ).json.data;
    const params = { id: String(g.id) };
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        call(addMember, "/x", { method: "POST", as: owner, params, body: { name: `คนที่ ${i}` } }),
      ),
    );
    expect(results.filter((r) => r.status === 201 || r.status === 200)).toHaveLength(2);
    const after = (await call(getGroup, "/x", { as: owner, params })).json.data;
    expect(after.memberCount).toBe(10);
    // ยอดหารเท่ากันถูกต้องหลังเพิ่มพร้อมกัน: 419 / 11 = 38.09 ต่อคน
    expect(new Set(after.members.map((m: { amount: number }) => m.amount))).toEqual(new Set([38.09]));
  });
});
