# ติดตั้งและรันโปรเจกต์

คู่มือติดตั้ง รัน และส่งงาน (README หลักอธิบายแค่ภาพรวมและ Stack)

## ทางลัดสำหรับผู้ตรวจ: import ไฟล์ SQL

ไฟล์ `tadyang.sql` (โฟลเดอร์ `submission/` หรือในลิงก์ส่งงาน) มีโครงสร้างทุกตาราง + ข้อมูลตัวอย่าง และสร้าง database `tadyang` ให้เอง

```bash
docker compose up -d                                         # หรือใช้ MySQL 8 / MariaDB ของ XAMPP ที่มีอยู่
docker exec -i tadyang-db mysql -uroot -proot < tadyang.sql  # XAMPP: phpMyAdmin → Import → เลือกไฟล์
```

> ⚠️ import ทับตารางใน database `tadyang` ที่มีอยู่เดิม

บัญชีตัวอย่าง (Admin และผู้ใช้ที่มี 7 รายการ) พร้อมรหัสผ่าน **อยู่ที่หัวไฟล์ `tadyang.sql`** ในลิงก์ส่งงาน — ไม่เขียนไว้ใน repo เพราะ repo เปิดบน GitHub

จากนั้นตั้ง `.env` ตามหัวข้อ "ตั้งเครื่องครั้งแรก" (ข้ามขั้น `db:migrate` / `db:seed`) แล้ว `npm run dev` · ไฟล์ทดสอบ import แล้วทั้ง MySQL 8.4 และ MariaDB 10.4 (XAMPP) แต่ตัวเว็บพัฒนาและทดสอบบน MySQL 8.4 — ถ้ารันกับ XAMPP ให้แก้ `DATABASE_URL` เป็นพอร์ตและรหัสของ XAMPP เช่น `mysql://root:@localhost:3306/tadyang`

## ตั้งเครื่องครั้งแรก

ต้องมี Node.js 24 ขึ้นไป และ Docker Desktop (เปิดไว้)

```bash
npm install
cp .env.example .env          # แล้วเติม SESSION_SECRET, CRON_SECRET, ADMIN_PASSWORD, DEMO_PASSWORD (คำสั่งสุ่มอยู่ในไฟล์)
npm run db:up                 # MySQL ที่พอร์ต 3307 + phpMyAdmin ที่ http://localhost:8080 (เปิดเฉพาะเครื่องนี้)
npm run db:migrate            # สร้างตาราง
npm run db:seed               # หมวด + 37 บริการ + บัญชี admin / demo ตามค่าใน .env
npm run dev                   # http://localhost:3000
```

เช็กว่าเว็บต่อฐานข้อมูลได้: เปิด http://localhost:3000/api/health ต้องได้ `{"data":{"status":"ok","db":"ok"}}`

บัญชีตัวอย่าง: ล็อกอินด้วย `DEMO_EMAIL` / `DEMO_PASSWORD` ใน `.env` (มี 7 รายการ ตัดเงินภายใน 7 วันข้างหน้า) · admin ใช้ `ADMIN_EMAIL` / `ADMIN_PASSWORD`

ราคาในรวมบริการเก็บเมื่อ 6 ต.ค. 2569 (ตรวจซ้ำและเพิ่มบริการ 9 ต.ค. 2569) พร้อมแหล่งอ้างอิงของแต่ละบริการใน [scripts/seed-data.ts](../scripts/seed-data.ts)

ปุ่ม "ลองใช้ด้วยบัญชีตัวอย่าง" หน้า login (เข้าบัญชี demo โดยไม่ต้องกรอกรหัส): ตั้ง `DEMO_LOGIN=true` ใน `.env` แล้ว restart — ค่าเริ่มต้นปิดไว้

## คำสั่งที่ใช้บ่อย

| คำสั่ง                | ทำอะไร                                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`         | รันเว็บโหมดพัฒนา                                                                                                                                                            |
| `npm run check`       | lint + typecheck + unit test + integration test (รันก่อนส่งงานทุกครั้ง ต้อง `db:up` ก่อน)                                                                                   |
| `npm run preflight`   | เช็กความพร้อมก่อน demo / หลัง deploy: `.env`, DB + migration + ข้อมูลเริ่มต้น, ล็อกอิน Gmail จริง (ไม่ส่งเมล), `APP_URL` ตอบไหม, Google — บอกวิธีแก้ทุกข้อ                  |
| `npm test`            | unit test (ไม่ต้องใช้ DB)                                                                                                                                                   |
| `npm run test:int`    | integration test กับ DB `tadyang_test` (สร้างและล้างให้เอง)                                                                                                                 |
| `npm run test:e2e`    | E2E ด้วย Playwright: build + start ที่พอร์ต 3200 กับ DB `tadyang_e2e` (ใช้ Edge ของ Windows — เครื่องอื่นตั้ง `PW_CHANNEL=chromium` หลัง `npx playwright install chromium`) |
| `npm run format`      | จัดรูปแบบโค้ดด้วย Prettier                                                                                                                                                  |
| `npm run db:generate` | สร้างไฟล์ migration `.sql` จาก `src/db/schema.ts`                                                                                                                           |
| `npm run db:migrate`  | รัน migration กับฐานข้อมูลใน `.env`                                                                                                                                         |
| `npm run db:seed`     | ใส่ข้อมูลเริ่มต้น (รันซ้ำได้ ไม่สร้างของซ้ำ)                                                                                                                                |
| `npm run db:reset`    | ล้างทุกตาราง → migrate → seed ใหม่ (ห้ามใช้บน production)                                                                                                                   |
| `npm run db:studio`   | ดูข้อมูลผ่าน Drizzle Studio                                                                                                                                                 |
| `npm run db:export`   | สร้าง `submission/tadyang.sql` (โครงสร้าง + ข้อมูลตัวอย่าง จาก DB ชั่วคราว ไม่แตะข้อมูลที่ใช้พัฒนา)                                                                         |
| `npm run pack:source` | zip source code จาก commit ล่าสุดเป็น `submission/tadyang-source.zip` (ไม่มี `.env` และ `node_modules`)                                                                     |
| `node scripts/audit-responsive.mjs` | ตรวจทุกหน้าที่ความกว้าง 360–1440px กับ dev server ที่รันอยู่: หาเลื่อนแนวนอน ล้นขอบจอ ข้อความถูกตัด และเก็บภาพหน้าจอ (ต้อง `DEMO_LOGIN=true` และตั้ง `AUDIT_ADMIN_EMAIL` / `AUDIT_ADMIN_PASSWORD`) |

## อีเมลแจ้งเตือน

- ค่าเริ่มต้น `MAIL_TRANSPORT=console` อีเมลจะพิมพ์ใน log ของเซิร์ฟเวอร์ ไม่ส่งจริง
- ส่งจริงผ่าน Gmail: เปิดยืนยันตัวตน 2 ขั้นของบัญชี Gmail โปรเจกต์ → สร้าง App Password → ใส่ `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` แล้วตั้ง `MAIL_TRANSPORT=smtp` → restart เซิร์ฟเวอร์
- งานเตือนรายวันรันเองทุก 08:00 และตอนเปิดเซิร์ฟเวอร์ สั่งรันเองได้ด้วย:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders
```

- กันใช้เป็นช่องส่งสแปม: อีเมลทดสอบ 1 ครั้ง/นาที (10 ครั้ง/วัน) · เตือนสมาชิกกลุ่ม 1 ครั้ง/วัน/อีเมล และรวม 20 ฉบับ/วัน/เจ้าของกลุ่ม

## Demo บนมือถือผ่าน Wi-Fi เดียวกัน

```bash
npm run build
npx next start -H 0.0.0.0 -p 3000
```

1. ตั้ง `APP_URL=http://<IP ของเครื่อง>:3000` ใน `.env` ก่อน build — ลิงก์จ่ายเงินและลิงก์ในอีเมลใช้ค่านี้
2. เปิด `http://<IP ของเครื่อง>:3000` บนมือถือ (อนุญาต Node.js ใน Windows Firewall ถ้าถูกถาม)
3. cookie เป็น `Secure` เฉพาะเมื่อ `APP_URL` เป็น `https://` จึงล็อกอินบน `http://IP` ได้

## Deploy จริง

รันบน Ubuntu server ด้วย Docker (Caddy + HTTPS อัตโนมัติ + MySQL) และตั้งค่าเข้าสู่ระบบด้วย Google — ดู [05-deploy.md](05-deploy.md)

## ปัญหาที่เจอบ่อย

- **หน้าตาเพี้ยน/คลาส Tailwind ไม่ทำงานหลังเพิ่มไฟล์ใหม่ตอน `npm run dev`** — หยุดแล้วรัน `npm run dev` ใหม่ (ตัวสแกนคลาสของ dev server บางครั้งไม่เห็นไฟล์ใหม่)
- **ต่อฐานข้อมูลไม่ได้** — เช็กว่า Docker Desktop เปิดอยู่ และ `npm run db:up` แล้ว (MySQL ใช้พอร์ต 3307)
- **ลิงก์จ่ายเงิน/ลิงก์ในอีเมลชี้ผิดพอร์ต** — `APP_URL` ใน `.env` ต้องตรงกับที่เปิดเว็บจริง
