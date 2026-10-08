# ตัดยัง? — Test Plan

> อ้างอิง: `docs/01-requirements.md` (user stories), `docs/02-architecture.md` (API contract, กฎธุรกิจข้อ 3.3), `docs/03-design.md` (สถานะ, a11y) · ผู้รับต่อ: test-engineer (unit/integration), e2e-tester (E2E), วันที่ลงมือหลัก: 13 ต.ค. แต่ **unit test ของ `lib/` เขียนพร้อมโค้ดตั้งแต่วันที่ 3**

---

## 1. กลยุทธ์

ความเสี่ยงจริงของโปรเจกต์นี้ไม่ได้อยู่ที่ UI แต่อยู่ที่ (1) **วันที่และเงิน** — คำนวณผิดแล้วไม่มีใครเห็นจนวัน demo (2) **สิทธิ์** — ผู้ใช้ A เห็นของ B (3) **อีเมลกับ QR** — สองสิ่งที่ demo สดต่อหน้ากรรมการ จึงแบ่งน้ำหนักแบบนี้:

| ระดับ | เครื่องมือ | ทดสอบอะไร | สัดส่วนโดยประมาณ |
|---|---|---|---|
| Unit | Vitest | ฟังก์ชัน pure ใน `src/lib/*` (billing, money, dates, split, promptpay, savings) + zod schemas | ~50% ของเคส · เร็ว รันทุกครั้งที่ save |
| Integration | Vitest + MySQL `tadyang_test` | route handler จริง + DB จริง: สิทธิ์, validation, กันส่งซ้ำ, ทรานแซกชันประวัติราคา | ~35% |
| E2E | Playwright | flow ตามลำดับ demo (docs/01 §8), responsive 375/1280, a11y อัตโนมัติ | ~15% · ช้า เลือกเฉพาะ flow ที่ต้องไม่พัง |
| Manual | มือ + มือถือจริง | สแกน QR ด้วยแอปธนาคาร, เปิดอีเมลจริงใน Gmail, ดูบนมือถือจริง | checklist ข้อ 6 |

**ไม่เทส:** หน้าตา pixel-perfect, ไลบรารีภายนอก (drizzle, nodemailer, promptpay-qr เอง — แต่เทส *ผลลัพธ์* ของ wrapper เรา), component ที่ไม่มี logic

---

## 2. สภาพแวดล้อมการเทส

- **DB เทส:** database `tadyang_test` ใน container เดียวกับ dev (`docker compose`) · env ของเทส (DB, secret ปลอม, `MAIL_TRANSPORT=console`) ตั้งใน `vitest.config.mts` project `integration` · globalSetup (`tests/integration/global-setup.ts`) ใช้ root สร้าง DB + drop ตาราง + migrate หนึ่งครั้ง → `setup.ts` ล้างทุกตาราง (`DELETE` ปิด FK check) **ก่อนทุกเทส** แล้วสร้างข้อมูลด้วย factory ใน `helpers.ts` ไม่พึ่ง seed · รัน `npm run test:int` (ต้อง `npm run db:up` ก่อน) และรวมอยู่ใน `npm run check`
- Integration รันแบบไม่ขนาน (`fileParallelism: false` เฉพาะ project integration) เพราะใช้ DB ร่วมกัน
- **เรียก route handler ตรง:** `call(POST, "/api/subscriptions", { method, body, as: user, params })` ใน `tests/integration/helpers.ts` สร้าง `Request` พร้อม `Origin`/`Host` และ cookie session ที่เซ็นจริงด้วย `SESSION_SECRET` ของเทส · `next/headers` ถูก mock ให้ `cookies()` อ่าน cookie นั้น (นอก Next ไม่มี request scope)
- `server-only` โยน error นอก React Server → alias เป็นไฟล์ว่างใน `vitest.config.mts`
- **เวลา:** ทุกฟังก์ชันที่ตัดสินว่า "วันนี้" รับ `today` เป็นพารามิเตอร์ (docs/02 §6) · เทสที่ผ่าน route ใช้ `vi.setSystemTime()` · **ทุกเคสวันที่ต้องรันผ่านทั้งตอนเครื่องตั้ง TZ เป็น UTC และ Asia/Bangkok** (รันชุด unit ซ้ำด้วย `TZ=UTC`)
- **อีเมล:** `MAIL_TRANSPORT=console` ในเทสทั้งหมด · integration ตรวจผลจากตาราง `notifications` + spy ที่ตัวส่งเมล
- **E2E:** Playwright ยิง `next build && next start` (ไม่ใช่ dev) ด้วย `CRON_ENABLED=false`, DB `tadyang_test` ที่ seed ด้วย `scripts/seed.ts`

---

## 3. Unit test — กฎธุรกิจ (`docs/02` §3.3)

| ID | ฟังก์ชัน | เคส | คาดหวัง | ระดับความสำคัญ |
|---|---|---|---|---|
| U-B1 | `nextBillingDate` (รายเดือน) | anchor 31, จาก 31 ม.ค. 2026 เลื่อน 1, 2, 3 รอบ | 28 ก.พ. → 31 มี.ค. → 30 เม.ย. (ไม่ไหลเป็น 28) | P0 |
| U-B2 | 〃 ปีอธิกสุรทิน | anchor 31 จาก 31 ม.ค. **2028** | 29 ก.พ. 2028 | P0 |
| U-B3 | 〃 รายปี | 29 ก.พ. 2028 + 1 ปี | 28 ก.พ. 2029 | P0 |
| U-B4 | `rollForward` | วันตัดเงินเลยมา 3 รอบ (เครื่องปิดนาน) | เลื่อนครั้งเดียวไปถึงรอบแรกที่ ≥ วันนี้ | P0 |
| U-B5 | 〃 | วันตัดเงิน = วันนี้ | **ไม่เลื่อน** (วันนี้ยังต้องแสดง "วันนี้") | P0 |
| U-M1 | `monthlyCost` | รายเดือน ฿419 / รายปี ฿1,290 | 419.00 / 107.50 | P0 |
| U-M2 | `sumMonthly` | 0.1 + 0.2 แบบสตางค์ | 0.30 ตรง ไม่มี float error | P0 |
| U-M3 | `sumMonthly` | รายการ cancelled ปนอยู่ | ไม่นับ cancelled | P0 |
| U-M4 | `formatBaht` | 1247, 99999.99, 0 | `฿1,247.00`, `฿99,999.99`, `฿0.00` | P1 |
| U-D1 | `todayInBangkok` | เวลา UTC 2026-10-06T18:30Z | `2026-10-07` (ตีหนึ่งครึ่งเวลาไทย) | P0 |
| U-D2 | `formatThaiDate` | 2026-10-09 สั้น/ยาว | `ศ. 9 ต.ค.` / `ศุกร์ 9 ตุลาคม 2569` | P1 |
| U-D3 | `daysUntil` | วันนี้, พรุ่งนี้, อีก 3 วัน | `วันนี้`, `พรุ่งนี้`, `อีก 3 วัน` | P1 |
| U-C1 | `projectMonth` (ปฏิทิน) | รายเดือน anchor 31 ขอเดือน ก.พ. | ขึ้นวันที่ 28 (หรือ 29) | P0 |
| U-C2 | 〃 | รายปีที่ตัดเดือน มี.ค. ขอเดือน ต.ค. | ไม่มีรายการ | P0 |
| U-C3 | 〃 | ขอเดือนก่อนหน้า `next_billing_date` | ไม่ฉายย้อนหลัง | P1 |
| U-C4 | 〃 | มี `trial_ends_at` ในเดือน | ได้รายการ kind `trial_end` แยก | P1 |
| U-S1 | `splitEqual` | ฿419 หาร 4 (สมาชิก 3 + เจ้าของ) | สมาชิกคนละ 104.75 เจ้าของ 104.75 | P1 |
| U-S2 | 〃 | ฿100 หาร 3 | สมาชิก 33.33 ×2 เจ้าของ 33.34 (เศษตกเจ้าของ) ผลรวม = 100.00 | P1 |
| U-S3 | `validateCustomSplit` | ผลรวมสมาชิก > ราคา | error | P1 |
| U-P1 | `promptpayPayload` | เบอร์ 0812345678 ยอด 105.00 | payload ตรงกับค่าอ้างอิงที่ได้จากแอปธนาคาร/ตัวสร้างทางการ รวม CRC16 4 ตัวท้าย | P1 |
| U-P2 | 〃 | เลขบัตร ปชช. 13 หลัก | tag 02 (national ID) ไม่ใช่ 01 | P1 |
| U-P3 | `maskPromptpay` | 0812345678 / 1234567890123 | `08x-xxx-5678` / `x-xxxx-xxxxx-12-3` | P1 |
| U-V1 | zod subscription | ราคาติดลบ, ไม่มีวันตัดเงิน, วันตัดเงินในอดีต, ไม่มีทั้ง planId และ customName | `VALIDATION_ERROR` พร้อม `fields` ตรงช่อง | P0 |
| U-V2 | zod register | รหัส 7 ตัว, อีเมลผิดรูป | error ตรงช่อง | P0 |
| U-V3 | zod settings | `notifyDaysBefore: 5` | error (รับแค่ 1/3/7) | P0 |
| U-SV1 | `savingsFor` *(P1)* | จ่ายรายเดือน ฿179 มีรายปี ฿1,790 | ประหยัด ฿358/ปี | P1 |
| U-SV2 | 〃 | ประหยัด < ฿1/เดือน | ไม่เสนอ | P1 |
| U-R1 | `pickReminders(today, rows)` | `days_before`=3, ตัดใน 0/3/4 วัน | เลือก 0 และ 3, ไม่เลือก 4 | P0 |
| U-R2 | 〃 | `notify_enabled=false` หรือผู้ใช้ถูกระงับ | ไม่เลือก | P0 |

---

## 4. Test matrix ตาม user story

ระดับ: **U** unit · **I** integration · **E** E2E · **M** manual

### A. Authentication

| ID | Story / AC | เคส | ระดับ | P |
|---|---|---|---|---|
| A1-1 | US-A1 | สมัครข้อมูลครบ → 201, role `user`, ได้ cookie `httpOnly` | I, E | P0 |
| A1-2 | US-A1 | อีเมลซ้ำ (ต่างตัวพิมพ์ใหญ่เล็ก `A@x.com` vs `a@x.com`) → 409 `EMAIL_TAKEN` "อีเมลนี้ถูกใช้แล้ว" | I | P0 |
| A1-3 | US-A1 | รหัสใน DB ขึ้นต้น `$2` (bcrypt) ไม่ใช่ข้อความเดิม | I | P0 |
| A1-4 | US-A1 | ส่ง `role: "admin"` มาใน body → ยังได้ role `user` | I | P0 |
| A2-1 | US-A2 | อีเมลผิด กับ รหัสผิด → 401 ข้อความ**เหมือนกันทุกตัวอักษร** | I | P0 |
| A2-2 | US-A2 | admin ล็อกอิน → เห็นเมนู `/admin` · user ไม่เห็น | E | P0 |
| A2-3 | US-A2 | logout → cookie ถูกลบ → `/api/auth/me` = 401 | I | P0 |
| A2-4 | ความปลอดภัย | ผิด 5 ครั้งใน 15 นาที → ครั้งที่ 6 ได้ 429 | I | P1 |
| A2-5 | ความปลอดภัย | บัญชีถูกระงับ → login 403 `ACCOUNT_SUSPENDED` · **cookie เดิมที่ยังไม่หมดอายุเรียก API ได้ 403 ทันที** | I | P0 |
| A3-1 | US-A3 | ไม่ล็อกอินเข้า `/dashboard` → redirect `/login?next=/dashboard` | E | P0 |
| A3-2 | US-A3 | role user เข้า `/admin` → หน้า 403 · เรียก `/api/admin/*` **ทุกเส้น** → 403 | E, I | P0 |
| A3-3 | US-A3 | user A `GET/PATCH/DELETE /api/subscriptions/:idของB` → 404 และข้อมูล B ไม่เปลี่ยน | I | P0 |
| A3-4 | US-A3 | user A `GET/PATCH/DELETE /api/groups/:idของB`, `PUT payments`, `POST notifications/:id/read` ของ B → 404 | I | P0 |
| A3-5 | US-A3 | cookie ปลอม (แก้ payload `role: admin` แล้วเซ็นด้วย key อื่น) → 401 | I | P0 |
| A3-6 | CSRF | POST ไม่มี `Origin` ตรงกับ `APP_URL` → 403 | I | P1 |
| A3-7 | ความปลอดภัย | **ไล่ทุก route ใน `src/app/api/`** โดยไม่มี cookie → ทุกเส้นที่ไม่ใช่ 🌐 ต้อง 401 (เทสสร้างลิสต์ route จากไฟล์จริง เพื่อจับ route ใหม่ที่ลืมใส่ `requireUser`) | I | P0 |

### B. คลังข้อมูล (ฝั่งผู้ใช้)

| ID | Story / AC | เคส | ระดับ | P |
|---|---|---|---|---|
| B1-1 | US-B1 | การ์ดมีโลโก้ ชื่อ หมวด ราคาเริ่มต้นเป็นบาท | E | P0 |
| B1-2 | US-B1 | ค้นหา "net" → มี Netflix · ค้นภาษาไทยได้ · ไม่พบ → empty state | I, E | P0 |
| B1-3 | US-B1 | กรองหมวด "ฟังเพลง" → มีแต่บริการหมวดนั้น | I | P0 |
| B1-4 | US-B1 | บริการ `is_active=false` ไม่โผล่ในรายการและ `/services/:slug` = 404 | I | P0 |
| B2-1 | US-B2 | แสดงแพ็กเกจครบ (ชื่อ ราคา รอบบิล คนสูงสุด) + วันที่อัปเดต | E | P0 |
| B2-2 | US-B2 | วิธียกเลิกแสดงเป็นขั้นตอน และ `#cancel` เลื่อนไปตรงนั้น | E | P0 |
| B2-3 | US-B2 | `cancel_steps` มี `<script>` → แสดงเป็นข้อความ ไม่รัน | I/E | P0 |
| B2-4 | US-B2 | ล็อกอินแล้วกด "เพิ่มเข้ารายการของฉัน" → ฟอร์มเติมราคา/รอบบิลจากแพ็กเกจ | E | P0 |
| B2-5 | US-B2 (P1) | กราฟประวัติราคา: แก้ราคา 2 ครั้ง → 3 จุด เรียงเก่า→ใหม่ | I | P1 |

### C. Subscription ของผู้ใช้

| ID | Story / AC | เคส | ระดับ | P |
|---|---|---|---|---|
| C1-1 | US-C1 | เพิ่มจากคลัง → `price` = ราคาแพ็กเกจ, `billing_anchor_day` = วันของ `nextBillingDate` | I | P0 |
| C1-2 | US-C1 | เพิ่มแบบ custom ต้องมี `customName` + `customCategoryId` | I | P0 |
| C1-3 | US-C1 | ราคาติดลบ / ไม่กรอกวันตัดเงิน → error ที่ช่องนั้น (API `fields` + UI แสดงใต้ช่อง) | I, E | P0 |
| C1-4 | US-C1 | `planId` ที่ไม่มีหรือถูกซ่อน → 404 | I | P0 |
| C2-1 | US-C2 | แก้ราคา/วัน → `anchor_day` อัปเดตตามวันใหม่ | I | P0 |
| C2-2 | US-C2 | ยกเลิก → `status=cancelled`, `cancelled_at` ตั้ง, ยังอยู่ในแท็บ "ยกเลิกแล้ว", ไม่ถูกนับในยอดรวม | I, E | P0 |
| C2-3 | US-C2 | ลบต้องผ่าน dialog ยืนยัน (กด "ยกเลิก" ใน dialog แล้วไม่หาย) → ลบแล้ว 404 | E | P0 |
| C2-4 | US-C2 | ถึงวันตัดเงินแล้ว → งานรายวันเลื่อนวันให้ (ดู U-B1–5) | I | P0 |
| C2-5 | ADR-005 | Admin แก้ราคาแพ็กเกจ → ราคาของผู้ใช้**ไม่เปลี่ยน** และ `catalogPrice` ต่างไป | I | P1 |

### D. Dashboard

| ID | Story / AC | เคส | ระดับ | P |
|---|---|---|---|---|
| D1-1 | US-D1 | ข้อมูลชุดรู้คำตอบ (รายเดือน 419 + 149, รายปี 1,290) → ต่อเดือน 675.50, ต่อปี 8,106.00, 3 รายการ | I | P0 |
| D1-2 | US-D1 | สัดส่วนตามหมวดรวมกันเท่ายอดต่อเดือน | I | P0 |
| D1-3 | US-D1 | upcoming: เฉพาะ 7 วันรวมวันนี้ เรียงตามวัน รวมวันหมดทดลอง | I | P0 |
| D1-4 | US-D1 | ผู้ใช้ใหม่ → empty state + ปุ่ม "เพิ่มรายการแรก" | E | P0 |
| D2-1 | US-D2 | ปฏิทินเดือนนี้แสดงโลโก้+ยอดในวันที่ถูก | E | P0 |
| D2-2 | US-D2 | กดวัน → เห็นรายละเอียดของวันนั้น · ใช้คีย์บอร์ดได้ | E | P0 |
| D2-3 | US-D2 | `?month=2026-13` → 400 | I | P1 |

### E. การแจ้งเตือน

| ID | Story / AC | เคส | ระดับ | P |
|---|---|---|---|---|
| E1-1 | US-E1 | ตั้งค่าได้ 1/3/7 ค่าเริ่มต้น 3 · ปิดแล้วไม่ได้อีเมล | I | P0 |
| E1-2 | US-E1 | `runReminders(today)`: รายการที่ตัดในอีก 3 วัน → 1 แถว email `sent` + 1 แถว in_app | I | P0 |
| E1-3 | US-E1 | **รัน `runReminders` สองรอบวันเดียวกัน → อีเมลไม่ส่งซ้ำ** (ตัวส่งถูกเรียกครั้งเดียว) | I | P0 |
| E1-4 | US-E1 | วันถัดไป (อีก 2 วัน) รันอีก → ยังไม่ส่งซ้ำสำหรับรอบบิลเดียวกัน · รอบบิลถัดไป → ส่งใหม่ได้ | I | P0 |
| E1-5 | US-E1 | ส่งพลาด (mock transport โยน error) → `failed, attempts=1` → รอบถัดไปลองใหม่ → สำเร็จเป็น `sent` · ครบ 3 ครั้งแล้วหยุด | I | P1 |
| E1-6 | US-E1 | เนื้ออีเมลมี ชื่อบริการ ยอด วันตัดเงินแบบไทย ลิงก์ `/services/{slug}#cancel` (custom → หน้าแก้รายการ) | I | P0 |
| E1-7 | ADR-004 | `POST /api/cron/reminders` ไม่มี/ผิด secret → 401 · ถูก → ได้ตัวนับ | I | P0 |
| E1-8 | §6 | เครื่องปิดวันที่ต้องเตือนพอดี → รันวันถัดไปยังส่ง (เพราะใช้ช่วง) | I | P0 |
| E2-1 | US-E2 | `trial_ends_at` อีก 3 วัน → อีเมลหัวเรื่อง trial "จะเริ่มเก็บเงินแล้ว…" แยกจาก billing | I | P0 |
| E3-1 | US-E3 | กระดิ่งแสดงจำนวนยังไม่อ่าน → กดอ่าน → ลดลง · "อ่านทั้งหมด" → 0 | I, E | P0 |
| E4-1 | US-E4 | ปุ่ม "ส่งอีเมลทดสอบ" → `sentTo` = อีเมลผู้ใช้, บันทึก `type=test`, ไม่กระทบตัวกันส่งซ้ำ | I, E | P0 |
| E4-2 | US-E4 | กดซ้ำภายใน 1 นาที → 429 | I | P1 |
| E-M | US-E1 | **ได้อีเมลจริงใน Gmail** ภาษาไทยไม่เพี้ยน ปุ่มกดได้ บนแอป Gmail มือถือ | M | P0 |

### F. หารค่าบริการ (P1)

| ID | Story / AC | เคส | ระดับ | P |
|---|---|---|---|---|
| F1-1 | US-F1 | สร้างกลุ่มหารเท่ากัน 3 คน → ยอดตาม U-S1 | I | P1 |
| F1-2 | US-F1 | custom: ผลรวมเกินราคา → 400 · สมาชิก 0 หรือ 11 คน → 400 | I | P1 |
| F1-3 | US-F1 | subscription เดิมสร้างกลุ่มซ้ำ → 409 `GROUP_EXISTS` | I | P1 |
| F1-4 | US-F1 | response ไม่มี PromptPay ID เต็ม มีแต่ `promptpayIdMasked` | I | P1 |
| F2-1 | US-F2 | `/pay/{token}` ไม่ล็อกอินเปิดได้ เห็นยอดของคนนั้น เดือน และ QR | E | P1 |
| F2-2 | US-F2 | token มั่ว / token ของสมาชิกที่ถูกลบ → 404 · token ยาว 43 ตัว สุ่มไม่ซ้ำ (สร้าง 1,000 ตัวไม่ชน) | I | P1 |
| F2-3 | US-F2 | หน้าจ่ายมี `noindex` และไม่มีข้อมูลสมาชิกคนอื่น | E | P1 |
| F2-M | US-F2 | **สแกน QR ด้วยแอปธนาคาร 2 แอป → ชื่อผู้รับถูก ยอดถูก** | M | P1 |
| F3-1 | US-F3 | กดจ่ายแล้ว/ยังไม่จ่าย ราย(สมาชิก, เดือน) · เดือนใหม่เริ่มเป็นยังไม่จ่าย | I, E | P1 |
| F3-2 | US-F3 | ส่งเตือนสมาชิกไม่มีอีเมล → 400 · ซ้ำวันเดียว → 429 | I | P1 |

### G. ตัวช่วยประหยัด (P1) — ครอบคลุมด้วย U-SV1–2 + I: `/api/savings` คืนเฉพาะรายการของผู้ใช้คนนั้น

### H. Admin

| ID | Story / AC | เคส | ระดับ | P |
|---|---|---|---|---|
| H1-1 | US-H1 | CRUD หมวด · slug ซ้ำ → 400 ที่ `fields.slug` · ลบหมวดที่มีบริการ → 409 `IN_USE` | I | P0 |
| H2-1 | US-H2 | CRUD บริการ · ซ่อนแล้วหายจากฝั่งผู้ใช้ | I, E | P0 |
| H2-2 | US-H2 | ลบบริการที่มีผู้ใช้ผูก → 409 ข้อความแนะนำให้ซ่อน · ข้อมูลไม่หาย | I, E | P0 |
| H3-1 | US-H3 | CRUD แพ็กเกจ | I | P0 |
| H3-2 | US-H3 | แก้ราคา → `price_history` 1 แถว (old/new/changed_by) · แก้ชื่ออย่างเดียว → ไม่มีแถวใหม่ | I | P0 |
| H3-3 | US-H3 | ถ้าเขียนประวัติพลาด → ราคาแพ็กเกจไม่เปลี่ยน (ทรานแซกชัน) | I | P1 |
| H4-1 | US-H4 | รายชื่อ + ค้นหา + แบ่งหน้า · response **ไม่มี** `password_hash` และไม่มีข้อมูล subscription | I | P0 |
| H4-2 | US-H4 | ระงับ → ผู้ใช้นั้นล็อกอิน/เรียก API ไม่ได้ (A2-5) · admin ระงับตัวเอง/admin อื่น → 400 | I | P0 |
| H5-1 | US-H5 | ข้อมูลรู้คำตอบ → totals ถูก (`avgMonthlyPerUser` หารด้วยผู้ใช้ที่มีรายการ active เท่านั้น) | I | P0 |
| H5-2 | US-H5 | Top 10, สัดส่วนหมวด, ผู้ใช้ใหม่ 30 วันมีครบ 30 จุดรวมวันที่เป็น 0 | I | P0 |
| H5-3 | US-H5 | `emailsThisMonth` นับเฉพาะ email `sent` ของเดือนปัจจุบันตามเวลาไทย | I | P0 |

### I. ข้อกำหนดที่ไม่ใช่ฟีเจอร์

| ID | เคส | ระดับ | P |
|---|---|---|---|
| N-1 | ทุกหน้าหลัก (landing, services, service detail, login, dashboard, subscriptions, ฟอร์มเพิ่ม, calendar, settings, admin ×4, pay) ที่ 375 และ 1280px: ไม่มี scroll แนวนอน, ปุ่มหลักมองเห็น | E | P0 |
| N-2 | `@axe-core/playwright` บนหน้าเดียวกัน: ไม่มี violation ระดับ serious/critical | E | P0 |
| N-3 | ใช้งาน flow เพิ่มรายการด้วยคีย์บอร์ดล้วน (Tab/Enter/Esc) ได้ และเห็น focus ring ทุกจุด | E/M | P0 |
| N-4 | ฟอร์มทุกช่องมี label ที่ผูกกับ input (`getByLabel` หาเจอ) | E | P0 |
| N-5 | ไม่มี secret ใน repo: `.env` ไม่ถูก track, `git grep` หา `SMTP_PASS=` ที่มีค่า → ไม่พบ | M (security-auditor) | P0 |
| N-6 | API error ทุกตัวรูป `{ error: { code, message } }` และ 500 ไม่มี stack trace | I | P0 |
| N-7 | วันที่แสดงแบบไทย พ.ศ. · เงินมี `฿` และ 2 ตำแหน่ง | U, E | P1 |
| N-8 | `npm run build` ผ่าน ไม่มี type error / lint error | CI | P0 |

---

## 5. E2E scenarios (Playwright)

เรียงตามลำดับ demo — ถ้าชุดนี้ผ่าน แปลว่า demo สดไม่พัง

| ID | Scenario | ขั้นตอนหลัก | P |
|---|---|---|---|
| S1 | **Happy path ผู้ใช้ใหม่** | สมัคร → empty state → เพิ่ม Netflix จากคลัง (ตัดอีก 3 วัน) → เพิ่ม custom → dashboard ยอดถูก → ปฏิทินมีรายการ → ตั้งค่า → กด "ส่งอีเมลทดสอบ" → toast สำเร็จ → กระดิ่งมีรายการ | P0 |
| S2 | **กันสิทธิ์** | ไม่ล็อกอินเข้า `/dashboard` → login · user เข้า `/admin` → 403 | P0 |
| S3 | **Admin แก้คลัง** | admin เพิ่มบริการ + แพ็กเกจ → แก้ราคา → ประวัติราคาขึ้น → ฝั่งผู้ใช้เห็นราคาใหม่ · ลบบริการที่มีคนใช้ → dialog แนะนำให้ซ่อน → ซ่อน → ฝั่งผู้ใช้หาไม่เจอ · dashboard admin แสดงตัวเลข | P0 |
| S4 | **ยกเลิก/ลบ** | ยกเลิกรายการ → ย้ายแท็บ ยอดลด → ลบ → dialog → หาย | P0 |
| S5 | **หารค่าบริการ** *(P1)* | สร้างกลุ่ม 3 คน → คัดลอกลิงก์ → เปิดใน context ใหม่ที่ไม่ล็อกอิน → เห็น QR และยอด → เจ้าของกดจ่ายแล้ว → หน้าจ่ายเปลี่ยนสถานะ | P1 |
| S6 | **Responsive + a11y** | N-1, N-2 ทุกหน้า × 2 ขนาดจอ | P0 |

---

## 6. Manual checklist ก่อน demo (12–13 ต.ค.)

- [ ] อีเมลแจ้งเตือนจริงเข้า Gmail (ไม่ตก Spam) ทั้ง billing, trial, test · เปิดบนแอป Gmail มือถือแล้วอ่านออก
- [ ] QR พร้อมเพย์: สแกนด้วยแอปธนาคารอย่างน้อย 2 แอป (เช่น K PLUS, SCB EASY) ด้วยเบอร์และยอดจริง → ชื่อและยอดถูก **(ทำเช้าวันที่ 7 ก่อนทำ UI กลุ่ม)**
- [ ] เปิดเว็บบนมือถือจริง 1 เครื่อง ผ่าน LAN (`next start -H 0.0.0.0`) ไล่ S1
- [ ] restart server แล้วงาน reminders รันตอนสตาร์ต (ดู log ตัวนับ)
- [ ] ล้าง DB → migrate → seed → admin ล็อกอินได้ (ซ้อมเตรียมเครื่อง demo)

---

## 7. เกณฑ์ผ่าน

| เกณฑ์ | เป้า |
|---|---|
| เคส P0 (unit + integration + E2E S1–S4, S6) | **ผ่าน 100%** ก่อนอัดคลิป/ส่งงาน |
| เคส P1 | ผ่านทุกเคสของฟีเจอร์ P1 ที่ส่งจริง (ฟีเจอร์ที่ตัดทิ้งให้ลบเคสออก ไม่ใช่ปล่อย fail) |
| Coverage `src/lib/**` | ≥ 90% lines (เป็น pure function ไม่มีข้ออ้าง) |
| Coverage `src/server/**` | ≥ 70% lines |
| ทุก acceptance criteria ใน docs/01 | มีอย่างน้อย 1 เคสใน matrix ข้อ 4 (ตรวจแล้ว ✅) |
| Security | ไม่มีปัญหาระดับ Critical/High จาก security-auditor |
| คำสั่ง | `npm run check` (lint + typecheck + test) ผ่าน และ `npm run build` ผ่าน |

## 8. ลำดับการเขียนเทส

1. **วันที่ 3–6 (พร้อมโค้ด):** unit ข้อ 3 ทั้งหมดของ lib ที่เขียนวันนั้น + integration กลุ่ม A3 (สิทธิ์) ทันทีที่มี route แรก — A3-7 ต้องมีตั้งแต่ route แรกเพื่อดักการลืมใส่ `requireUser`
2. **วันที่ 6:** integration E1-x (reminders) — ฟีเจอร์ที่ต้องได้อีเมลจริงตอน demo
3. **วันที่ 7:** U-P1 ก่อนสแกนด้วยแอปธนาคาร
4. **วันที่ 8:** E2E S1–S6, a11y, ปิดช่องที่เหลือใน matrix
