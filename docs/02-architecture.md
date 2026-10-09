# ตัดยัง? — Architecture

> อ้างอิง: `docs/01-requirements.md` · เขียนวันที่ 6 ต.ค. 2569 · ผู้รับต่อ: devops-engineer, database-engineer, backend-developer, frontend-developer, test-planner

---

## 1. Tech stack

| ชั้น | เลือก | เวอร์ชัน (ณ 6 ต.ค. 69) | เหตุผล | ตัดทิ้ง |
|---|---|---|---|---|
| Runtime | Node.js | 24 LTS (เครื่องมี v24.17) | — | — |
| Framework | **Next.js App Router** (frontend + API ในโปรเจกต์เดียว) | 16.x | repo เดียว รันคำสั่งเดียว เหมาะกับทีม 3 คน | แยก Express backend: deploy สองตัว ต้องตั้ง CORS |
| ภาษา | TypeScript (strict) | — | type จาก schema ไหลถึง UI | — |
| Database | **MySQL 8.4** ผ่าน Docker (`docker compose up -d db`) | 8.4 | ตรงโจทย์, ทุกเครื่องได้เวอร์ชันเดียวกัน | XAMPP (MariaDB 10.4) ใช้สำรองได้ แต่ห้ามใช้ฟีเจอร์ที่ MariaDB 10.4 ไม่มี |
| ORM / migration | **Drizzle ORM + mysql2 + drizzle-kit** | 0.45 / 3.x / 0.31 | schema เป็น TS, query ใกล้ SQL, `drizzle-kit generate` ได้ไฟล์ `.sql` ส่งอาจารย์ได้ทันที | Prisma: v7 บังคับ driver adapter และ v8 ยังเป็น RC, เสี่ยงเจอ breaking change กลางงาน |
| Validation | Zod | 4.x | ใช้ schema เดียวกันทั้งฟอร์มฝั่ง client และ API | — |
| Auth | **เขียนเอง:** bcryptjs + JWT (jose) ใน httpOnly cookie | bcryptjs 3 / jose 6 | สั้น อธิบายตอนนำเสนอหัวข้อ Authentication ได้ทุกบรรทัด | Auth.js: credentials provider ซับซ้อนเกินงาน, `bcrypt` (native) build ยากบน Windows |
| Styling | Tailwind CSS | 4.x | ใส่ design tokens (dark + vivid + glass) เป็น CSS variables | UI kit สำเร็จรูป: ได้หน้าตาเทมเพลต |
| ฟอนต์ | `next/font/google`: Bai Jamjuree (หัวข้อ), IBM Plex Sans Thai (เนื้อหา), IBM Plex Mono (ตัวเลข) | — | ตามที่เลือกไว้ในรอบออกแบบ | — |
| กราฟ | **CSS/SVG เขียนเอง** (`components/charts/`) | — | กราฟทั้งหมดเป็นข้อมูลชุดเดียว (แท่งนอน + เส้น 1 เส้น) เขียนเองสั้นกว่า คุมธีมได้ครบ และไม่เพิ่ม JS ให้หน้าเว็บ | Recharts: ถอดออกวันที่ 6 เพราะไม่ได้ใช้ความสามารถที่คุ้มกับขนาด bundle |
| อีเมล | Nodemailer + Gmail SMTP (App Password) | — | ตามโจทย์ | Resend/SendGrid: ต้องยืนยันโดเมน |
| ตั้งเวลา | node-cron ที่สตาร์ตใน `instrumentation.ts` + endpoint สั่งรันเอง | 4.x | ไม่ต้องตั้ง Task Scheduler ของ Windows | cron ของ OS: ตั้งต่างกันทุกเครื่อง |
| QR พร้อมเพย์ | `promptpay-qr` (สร้าง payload EMVCo) + `qrcode` (เรนเดอร์ SVG) | 0.5 / 1.5 | ไลบรารีเล็ก ทำงานบน server | เขียน EMVCo + CRC16 เอง: เสี่ยงผิดโดยไม่รู้ตัว |
| เทส | Vitest (unit/integration) + Playwright (E2E) | — | test-planner กำหนดรายละเอียดใน `docs/04` | Jest: ต้องตั้ง transform สำหรับ ESM/TS เพิ่ม |

**ไม่ใช้ (ตาม scope):** state manager (Redux/Zustand), UI kit, markdown renderer, Redis, queue, AI ทุกรูปแบบ

> ⚠️ Next.js 16 เปลี่ยนหลายจุดจากที่หลายคนคุ้น เช่น `middleware.ts` เปลี่ยนชื่อเป็น `proxy.ts` และ `params` / `searchParams` / `cookies()` เป็น async ทั้งหมด **ก่อนเขียนไฟล์ระดับ framework ให้เปิดดู `node_modules/next/dist/docs/` ของเวอร์ชันที่ติดตั้งจริง**

---

## 2. โครงสร้างโฟลเดอร์

```
finalproject/
├─ docs/                         # 01 requirements, 02 architecture, 03 design, 04 test plan, 05 deployment
├─ drizzle/                      # migration .sql ที่ drizzle-kit generate (commit ไว้ ห้ามแก้มือ)
├─ public/logos/                 # โลโก้บริการใน seed (svg/png)
├─ scripts/
│  ├─ seed.ts                    # หมวดหมู่ + บริการจริง ~20 รายการ + admin จาก env + user ตัวอย่าง
│  └─ export-sql.sh              # mysqldump → submission/tadyang.sql (วันที่ 9)
├─ src/
│  ├─ app/
│  │  ├─ (public)/               # ไม่ต้องล็อกอิน
│  │  │  ├─ page.tsx             # landing
│  │  │  ├─ services/page.tsx    # คลังบริการ: ค้นหา + กรองหมวด
│  │  │  ├─ services/[slug]/page.tsx
│  │  │  ├─ login/page.tsx
│  │  │  └─ register/page.tsx
│  │  ├─ (app)/                  # layout ตรวจ session → ไม่มีให้ redirect /login
│  │  │  ├─ dashboard/page.tsx
│  │  │  ├─ subscriptions/page.tsx, new/page.tsx, [id]/edit/page.tsx
│  │  │  ├─ calendar/page.tsx
│  │  │  ├─ settings/page.tsx    # แจ้งเตือน + ปุ่มส่งอีเมลทดสอบ
│  │  │  ├─ groups/page.tsx, new/page.tsx, [id]/page.tsx   # P1
│  │  │  └─ savings/page.tsx     # P1
│  │  ├─ admin/                  # layout ตรวจ role admin → ไม่ใช่ให้ 403 page
│  │  │  ├─ page.tsx             # dashboard ภาพรวม
│  │  │  ├─ categories/page.tsx
│  │  │  ├─ services/page.tsx, [id]/page.tsx   # [id] = แก้บริการ + แพ็กเกจ + ประวัติราคา
│  │  │  └─ users/page.tsx
│  │  ├─ pay/[token]/page.tsx    # หน้าจ่ายเงินของสมาชิกกลุ่ม (public, P1)
│  │  └─ api/                    # route handlers ตามข้อ 5
│  ├─ components/
│  │  ├─ ui/                     # ปุ่ม, input, card, dialog, toast — ตาม design system
│  │  └─ …                       # component ตามฟีเจอร์ เช่น subscription-form.tsx, calendar-grid.tsx
│  ├─ db/
│  │  ├─ schema.ts               # Drizzle schema ทุกตาราง (แหล่งความจริงเดียว)
│  │  └─ index.ts                # connection pool (mysql2)
│  ├─ lib/                       # ฟังก์ชัน pure ไม่แตะ DB → unit test ง่าย
│  │  ├─ billing.ts              # เลื่อนวันตัดเงิน, monthlyCost, projection ลงปฏิทิน
│  │  ├─ money.ts                # คำนวณเป็นสตางค์ (integer), format ฿
│  │  ├─ dates.ts                # todayInBangkok(), format วันที่ไทย
│  │  ├─ split.ts                # หารเท่ากัน/ปัดเศษ
│  │  ├─ promptpay.ts            # payload + mask ID
│  │  ├─ savings.ts              # P1 คำนวณข้อเสนอประหยัด
│  │  └─ validation/             # zod schemas ใช้ร่วม client/server
│  ├─ server/                    # import "server-only" ทุกไฟล์
│  │  ├─ env.ts                  # ตรวจ env ด้วย zod ตอนโหลด ขาดตัวไหนพังทันทีพร้อมบอกชื่อ
│  │  ├─ auth.ts                 # hash, sign/verify JWT, getSession, requireUser, requireAdmin
│  │  ├─ http.ts                 # ok(), fail(), parseBody() — รูปแบบ response เดียวทั้งระบบ
│  │  ├─ mailer.ts               # nodemailer transport + template
│  │  ├─ rate-limit.ts           # in-memory counter
│  │  └─ services/               # business logic + query ตามโดเมน
│  │     ├─ catalog.ts, subscriptions.ts, dashboard.ts, notifications.ts,
│  │     ├─ reminders.ts         # งานรายวัน (roll + ส่งอีเมล)
│  │     ├─ groups.ts            # P1
│  │     └─ admin.ts             # CRUD คลัง + สถิติ
│  ├─ instrumentation.ts         # สตาร์ต node-cron 08:00 Asia/Bangkok (เฉพาะ runtime nodejs)
│  └─ proxy.ts                   # กัน route หน้าเว็บ /dashboard… /admin… ตาม cookie
├─ tests/unit/ …   e2e/ …
├─ docker-compose.yml            # MySQL 8.4 (+ phpMyAdmin สำหรับดูข้อมูลตอน demo)
├─ drizzle.config.ts
├─ .env.example
└─ README.md
```

**หลักแบ่งชั้น:** `app/api/*` บางที่สุด (auth → validate → เรียก service → ส่ง response) · `server/services/*` คือที่เดียวที่เขียน query · `lib/*` เป็น pure function · Server Component อ่านข้อมูลด้วยการเรียก service ตรง (ไม่ยิง HTTP หาตัวเอง) ส่วน**การแก้ข้อมูลทุกอย่างผ่าน REST API** เพื่อให้ contract ชัดและเทสด้วย curl/Vitest ได้

---

## 3. Data model

### 3.1 ER diagram

```mermaid
erDiagram
    users ||--o{ user_subscriptions : owns
    users ||--o{ notifications : receives
    users ||--o{ share_groups : owns
    categories ||--o{ services : groups
    categories ||--o{ user_subscriptions : "custom_category"
    services ||--o{ plans : offers
    plans ||--o{ price_history : "price changes"
    plans ||--o{ user_subscriptions : "subscribed as"
    user_subscriptions ||--o{ notifications : about
    user_subscriptions ||--o| share_groups : "shared via"
    share_groups ||--o{ group_members : has
    group_members ||--o{ member_payments : "pays per month"
    users ||--o{ feedback : "sends"

    users {
        int id PK
        varchar name
        varchar email UK
        varchar password_hash
        enum role "user|admin"
        enum status "active|suspended"
        bool notify_enabled
        tinyint notify_days_before "1|3|7"
    }
    categories {
        int id PK
        varchar name
        varchar slug UK
        int sort_order
    }
    services {
        int id PK
        int category_id FK
        varchar name
        varchar slug UK
        varchar logo_url
        varchar website_url
        text cancel_steps
        bool is_active
        datetime updated_at
    }
    plans {
        int id PK
        int service_id FK
        varchar name
        decimal price
        enum billing_cycle "monthly|yearly"
        tinyint max_members
        bool is_active
    }
    price_history {
        int id PK
        int plan_id FK
        decimal old_price
        decimal new_price
        int changed_by FK
        datetime changed_at
    }
    user_subscriptions {
        int id PK
        int user_id FK
        int plan_id FK "null = custom"
        varchar custom_name
        int custom_category_id FK
        decimal price
        enum billing_cycle
        date next_billing_date
        tinyint billing_anchor_day
        date trial_ends_at
        varchar payment_method
        enum status "active|cancelled"
    }
    notifications {
        int id PK
        int user_id FK
        int user_subscription_id FK
        enum type
        enum channel "email|in_app"
        date due_date
        enum status "pending|sent|failed"
        datetime read_at
    }
    share_groups {
        int id PK
        int owner_id FK
        int user_subscription_id FK,UK
        varchar promptpay_id
        enum split_mode "equal|custom"
    }
    group_members {
        int id PK
        int group_id FK
        varchar name
        varchar email
        decimal amount
        char pay_token UK
    }
    member_payments {
        int id PK
        int member_id FK
        char period "YYYY-MM"
        enum status "unpaid|paid"
        datetime paid_at
    }
    feedback {
        int id PK
        int user_id FK
        enum kind "bug | suggestion | other"
        text message
        enum status "new | read | acknowledged | in_progress | resolved"
        text reply "คำตอบจาก admin"
        datetime replied_at
        datetime created_at
    }
```

### 3.2 รายละเอียดตาราง

ทุกตาราง: `id INT UNSIGNED AUTO_INCREMENT PK`, `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`, `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` (เว้นที่ระบุ) · charset `utf8mb4` · เงินใช้ `DECIMAL(10,2)` · วันที่ปฏิทิน (วันตัดเงิน/หมดทดลอง) ใช้ `DATE` ตีความเป็นเวลาไทย · timestamp เก็บ UTC

| ตาราง | คอลัมน์ / constraint ที่สำคัญ | FK on delete |
|---|---|---|
| `users` | `email VARCHAR(191) UNIQUE`, `role ENUM('user','admin') DEFAULT 'user'`, `status ENUM('active','suspended') DEFAULT 'active'`, `notify_enabled BOOL DEFAULT 1`, `notify_days_before TINYINT DEFAULT 3` (app ยอมแค่ 1/3/7) | — |
| `categories` | `name VARCHAR(50)`, `slug VARCHAR(50) UNIQUE`, `icon VARCHAR(50) NULL`, `sort_order INT DEFAULT 0` | — |
| `services` | `slug UNIQUE`, `logo_url VARCHAR(500) NULL`, `website_url VARCHAR(500) NULL`, `cancel_steps TEXT` (**ข้อความหลายบรรทัด 1 บรรทัด = 1 ขั้นตอน** เรนเดอร์เป็น `<ol>` ไม่ใช้ markdown → ไม่มีช่อง XSS ไม่มี dependency), `is_active BOOL DEFAULT 1`, `updated_at` = "อัปเดตข้อมูลล่าสุด" ที่โชว์ผู้ใช้ · index `(category_id, is_active)` | `category_id` RESTRICT |
| `plans` | `name VARCHAR(100)`, `price DECIMAL(10,2)`, `billing_cycle ENUM('monthly','yearly')`, `max_members TINYINT DEFAULT 1` (>1 = Family plan), `is_active BOOL DEFAULT 1` | `service_id` CASCADE |
| `price_history` | `old_price`, `new_price`, `changed_by INT NULL`, `changed_at` (ไม่มี updated_at) · index `(plan_id, changed_at)` · **เขียนในทรานแซกชันเดียวกับการแก้ราคา** | `plan_id` CASCADE, `changed_by` SET NULL |
| `user_subscriptions` | `plan_id NULL` (null = custom), `custom_name VARCHAR(100) NULL`, `custom_category_id NULL`, `price`, `billing_cycle`, `next_billing_date DATE`, `billing_anchor_day TINYINT` (1–31), `trial_ends_at DATE NULL`, `payment_method VARCHAR(100) NULL`, `note VARCHAR(500) NULL`, `status ENUM('active','cancelled') DEFAULT 'active'`, `cancelled_at DATETIME NULL` · index `(user_id, status)`, `(status, next_billing_date)` · กฎ: มี `plan_id` **หรือ** (`custom_name` + `custom_category_id`) อย่างใดอย่างหนึ่ง (บังคับใน zod) | `user_id` CASCADE, `plan_id` RESTRICT, `custom_category_id` RESTRICT |
| `notifications` | `type ENUM('billing_reminder','trial_ending','member_reminder','test','feedback_reply')`, `channel ENUM('email','in_app')`, `title VARCHAR(200)`, `body VARCHAR(1000)`, `link VARCHAR(300) NULL`, `due_date DATE NULL`, `status ENUM('pending','sent','failed')`, `attempts TINYINT DEFAULT 0`, `read_at DATETIME NULL` · **`UNIQUE (user_subscription_id, type, due_date, channel)` = กันส่งซ้ำ** (แถว test มี due_date NULL จึงไม่ติด) · index `(user_id, channel, read_at)` | `user_id` CASCADE, `user_subscription_id` SET NULL (ประวัติ/สถิติอีเมลไม่หายเมื่อผู้ใช้ลบรายการ) |
| `share_groups` *(P1)* | `user_subscription_id UNIQUE` (1 รายการ = 1 กลุ่ม), `promptpay_id VARCHAR(20)` (เบอร์ 10 หลัก / บัตร ปชช. 13 หลัก), `split_mode ENUM('equal','custom')` | `owner_id` CASCADE, `user_subscription_id` CASCADE |
| `group_members` *(P1)* | `name VARCHAR(100)`, `email VARCHAR(191) NULL`, `amount DECIMAL(10,2)`, `pay_token CHAR(43) UNIQUE` (32 byte สุ่ม base64url) | `group_id` CASCADE |
| `member_payments` *(P1)* | `period CHAR(7)` เช่น `2026-10`, `status ENUM('unpaid','paid')`, `paid_at`, `reminded_at` · `UNIQUE (member_id, period)` · **ไม่มีแถว = ยังไม่จ่าย** (สร้างแถวตอนกดเปลี่ยนสถานะ) | `member_id` CASCADE |
| `feedback` | `kind ENUM('bug','suggestion','other')`, `message TEXT` (10–2,000 ตัวอักษร), `status ENUM('new','read','acknowledged','in_progress','resolved')` default `new` (3 ขั้นท้าย = แถบความคืบหน้าที่ผู้ใช้เห็น · `read` = อ่าน/ตอบแล้วไม่ต้องติดตาม เช่น คำชม), `reply TEXT NULL` + `replied_at` (คำตอบจาก admin) · index `(status, created_at)`, `(user_id, created_at)` | `user_id` CASCADE |

**ต่างจาก `docs/01` §5 หนึ่งจุด:** PromptPay ID เก็บที่ `share_groups` ไม่ใช่ `users` — ใช้แค่ตอนหาร และเก็บเฉพาะเมื่อผู้ใช้สร้างกลุ่ม (เก็บข้อมูลส่วนตัวให้น้อยที่สุด) ฟอร์มสร้างกลุ่มใหม่ prefill จากกลุ่มล่าสุดของผู้ใช้ได้

### 3.3 กฎทางธุรกิจที่ต้องอยู่ใน `lib/` และมี unit test

1. **ราคาของผู้ใช้เป็น snapshot** — เพิ่มจากคลังแล้วคัดลอก `price`/`billing_cycle` ของแพ็กเกจมาเก็บใน `user_subscriptions` Admin แก้ราคาในคลังแล้ว**ราคาของผู้ใช้ไม่เปลี่ยนเอง** (ผู้ใช้อาจได้ราคาโปรฯ) หน้ารายการแสดงป้าย "ราคาในคลังเปลี่ยนเป็น ฿X" ถ้าต่างกัน
2. **เลื่อนวันตัดเงิน** — `billing_anchor_day` = วันที่ของ `next_billing_date` ตอนสร้าง/แก้ เลื่อนทีละรอบแล้ว clamp เป็นวันสุดท้ายของเดือนถ้าเดือนนั้นสั้นกว่า (31 ม.ค. → 28 ก.พ. → **31 มี.ค.** ไม่ไหลเป็น 28 มี.ค.) รายปี: 29 ก.พ. → 28 ก.พ. ปีถัดไป
3. **เลื่อนเมื่อไหร่** — งานรายวัน 08:00 และตอนเซิร์ฟเวอร์สตาร์ต: รายการ `active` ที่ `next_billing_date < วันนี้ (ไทย)` เลื่อนไปจน `>= วันนี้` · ฟอร์มสร้าง/แก้บังคับ `nextBillingDate >= วันนี้` จึงไม่มีรายการเกิดมาในอดีต
4. **ค่าใช้จ่ายต่อเดือน** — รายเดือน = price · รายปี = price / 12 · ยอดต่อปี = ผลรวมรายเดือน × 12 · **คิดเป็นสตางค์ (integer) แล้วค่อยแปลงตอนแสดง** · นับเฉพาะ `active`
5. **ชื่อ/หมวด/โลโก้ที่แสดง** — มี plan: `service.name` + `plan.name`, หมวดของ service, โลโก้ service · custom: `custom_name`, `custom_category_id`, โลโก้ = ตัวอักษรย่อ
6. **ปฏิทิน** — ฉายรายการ active ลงเดือนที่ขอ: รายเดือนขึ้นเดือนละครั้งที่ anchor day (clamp), รายปีขึ้นเฉพาะเดือนที่ตรง, ไม่ฉายย้อนก่อน `next_billing_date` ปัจจุบัน · `trial_ends_at` ขึ้นเป็นอีกชนิด (`trial_end`)
7. **หารเท่ากัน** — ส่วนต่อคน = floor(ราคาเป็นสตางค์ / (สมาชิก + เจ้าของ)) เศษสตางค์ตกที่เจ้าของ · ส่วนของเจ้าของ = ราคา − ผลรวมของสมาชิก · โหมด custom: ผลรวมของสมาชิกต้อง ≤ ราคา

---

## 4. Authentication & Authorization

**Session**
- สมัคร: zod (`name` 1–100, `email`, `password` ≥ 8) → bcryptjs cost 10 → insert role `user` → ตั้ง cookie ทันที
- Cookie `session` = JWT HS256 (jose) payload `{ sub: userId, role }` อายุ 7 วัน · `httpOnly`, `sameSite=lax`, `secure` เมื่อ production, `path=/`
- Logout = ลบ cookie
- **ไม่มีทางสมัครเป็น admin ผ่านเว็บ** — admin สร้างจาก `scripts/seed.ts` ด้วย `ADMIN_EMAIL`/`ADMIN_PASSWORD`

**สองชั้นตรวจ**
1. `src/proxy.ts` (เร็ว ไม่แตะ DB): verify ลายเซ็น JWT → ไม่มี/ไม่ถูก บน `/dashboard|/subscriptions|/calendar|/settings|/groups|/savings` → redirect `/login?next=…` · `/admin/*` ที่ role ไม่ใช่ admin → rewrite ไปหน้า 403 · **proxy ไม่พาคนที่ล็อกอินแล้วออกจาก /login** (ทำใน page ด้วย `redirectIfSignedIn()` ที่เช็ก DB) เพราะถ้าเช็กแค่ token บัญชีที่ถูกระงับจะติด redirect วน /dashboard ↔ /login
2. **ทุก API handler** เรียก `requireUser()` / `requireAdmin()` ซึ่งโหลดผู้ใช้จาก DB ทุกครั้ง → ไม่พบ = 401, `status = 'suspended'` = 403 `ACCOUNT_SUSPENDED` (ระงับแล้วมีผลทันทีไม่ต้องรอ token หมดอายุ), ไม่ใช่ admin = 403 `FORBIDDEN` · **ห้ามเชื่อ role ใน JWT สำหรับ API**

**ความเป็นเจ้าของ (US-A3)** — ทุก query ของข้อมูลผู้ใช้มี `WHERE user_id = :sessionUserId` อยู่ใน SQL (ไม่ใช่ดึงมาแล้วค่อยเช็ก) ไม่พบ → **404** `NOT_FOUND` เสมอ (ไม่บอกว่ามีแต่ไม่ใช่ของคุณ)

**อื่น ๆ**
- Login ผิด: 401 `INVALID_CREDENTIALS` ข้อความเดียวกันทั้งอีเมลผิดและรหัสผิด · ผิด 5 ครั้งใน 15 นาทีต่ออีเมล → 429 `RATE_LIMITED` (in-memory พอสำหรับ process เดียว)
- CSRF: `sameSite=lax` + API ที่ไม่ใช่ GET ต้องมี `Content-Type: application/json` และ host ของ header `Origin` ต้องตรงกับ `Host` ของ request (ไม่เทียบกับ `APP_URL` เพื่อให้เปิดผ่าน IP ในวง LAN บนมือถือตอน demo ได้)
- Admin เห็นเฉพาะข้อมูลบัญชี (US-H4) — `/api/admin/users` select แค่ `id, name, email, role, status, created_at` + `loginMethods` (`email`/`google` คำนวณใน SQL ว่ามี/ไม่มี — hash และ google_sub ไม่ออกจาก DB) และ admin ระงับตัวเอง/admin คนอื่นไม่ได้

---

## 5. API contract

### 5.1 ข้อตกลงร่วม

- JSON ทั้งหมด, base `/api`, ฟิลด์ใน JSON เป็น camelCase
- สำเร็จ: `200`/`201` → `{ "data": … }` · ลบสำเร็จ: `204` ไม่มี body · รายการแบบแบ่งหน้า: `{ "data": [...], "meta": { "page": 1, "pageSize": 20, "total": 57 } }`
- Error ทุกตัวรูปเดียวกัน:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "กรุณาตรวจสอบข้อมูล", "fields": { "price": "ราคาต้องไม่ติดลบ" } } }
  ```
  `fields` มีเฉพาะ `VALIDATION_ERROR` · `message` เป็นภาษาไทยที่โชว์ผู้ใช้ได้ตรง ๆ

| HTTP | code |
|---|---|
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN`, `ACCOUNT_SUSPENDED` |
| 404 | `NOT_FOUND` |
| 409 | `EMAIL_TAKEN`, `IN_USE` (ลบของที่มีคนผูกอยู่), `GROUP_EXISTS` |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` (ไม่ส่ง stack ออกไป) |

- เงิน: JSON number 2 ตำแหน่ง (`419.00` → `419`) · วันที่ปฏิทิน: `"YYYY-MM-DD"` · timestamp: ISO 8601 UTC
- สิทธิ์ในตาราง: 🌐 public · 👤 ผู้ใช้ที่ล็อกอิน · 🛡 admin · 🔑 `Authorization: Bearer $CRON_SECRET`

### 5.2 Object ที่ใช้ซ้ำ

```ts
type User = { id: number; name: string; email: string; role: "user" | "admin";
              notifyEnabled: boolean; notifyDaysBefore: 1 | 3 | 7; createdAt: string };

type Category = { id: number; name: string; slug: string; icon: string | null; sortOrder: number };

type Plan = { id: number; name: string; price: number; billingCycle: "monthly" | "yearly";
              maxMembers: number; isActive: boolean };

type ServiceSummary = { id: number; slug: string; name: string; logoUrl: string | null;
                        category: Category; startingPrice: number | null;   // แพ็กเกจรายเดือนถูกสุด
                        startingCycle: "monthly" | "yearly" | null };

type ServiceDetail = ServiceSummary & { websiteUrl: string | null; cancelSteps: string[];  // แยกบรรทัดแล้ว
                                        plans: Plan[]; updatedAt: string };

type Subscription = {
  id: number; name: string; logoUrl: string | null; category: Category;
  isCustom: boolean; service: { id: number; slug: string } | null; plan: { id: number; name: string } | null;
  price: number; billingCycle: "monthly" | "yearly"; monthlyCost: number;
  catalogPrice: number | null;          // ราคาปัจจุบันในคลัง (ไว้โชว์ป้าย "ราคาในคลังเปลี่ยน")
  nextBillingDate: string; trialEndsAt: string | null;
  paymentMethod: string | null; note: string | null;
  status: "active" | "cancelled"; cancelledAt: string | null; createdAt: string;
  groupId: number | null;
};

type Notification = { id: number; type: "billing_reminder" | "trial_ending" | "member_reminder" | "test" | "feedback_reply";
                      title: string; body: string; link: string | null; readAt: string | null; createdAt: string };
```

### 5.3 Auth

| | Method + path | Request | Response | Error |
|---|---|---|---|---|
| 🌐 | `POST /api/auth/register` | `{ name, email, password }` | `201 { data: User }` + cookie | 400, 409 `EMAIL_TAKEN` |
| 🌐 | `POST /api/auth/login` | `{ email, password }` | `200 { data: User }` + cookie | 400, 401 `INVALID_CREDENTIALS`, 403 `ACCOUNT_SUSPENDED`, 429 |
| 🌐 | `POST /api/auth/demo` | — | `200 { data: User }` + cookie ของบัญชี `DEMO_EMAIL` (เปิดเมื่อ `DEMO_LOGIN=true`, role user เท่านั้น) | 404 ปิดอยู่/ไม่มีบัญชี, 429 |
| 👤 | `POST /api/auth/logout` | — | `204` ลบ cookie | — |
| 👤 | `GET /api/auth/me` | — | `{ data: User }` | 401 |

### 5.4 คลังข้อมูล (ฝั่งผู้ใช้)

| | Method + path | Request | Response |
|---|---|---|---|
| 🌐 | `GET /api/categories` | — | `{ data: Category[] }` เรียงตาม sortOrder |
| 🌐 | `GET /api/services` | query `q?` (ค้นชื่อ), `category?` (slug) | `{ data: ServiceSummary[] }` เฉพาะ `isActive` |
| 🌐 | `GET /api/services/:slug` | — | `{ data: ServiceDetail }` (plans เฉพาะ active) · 404 |
| 🌐 | `GET /api/plans/:id/price-history` *(P1)* | — | `{ data: { price: number; from: string }[] }` เรียงเก่า→ใหม่ จุดแรก = ราคาตอนสร้าง |

### 5.5 Subscription ของฉัน

| | Method + path | Request | Response | Error |
|---|---|---|---|---|
| 👤 | `GET /api/subscriptions` | query `status=active\|cancelled\|all` (default `active`) | `{ data: Subscription[] }` เรียง nextBillingDate | — |
| 👤 | `POST /api/subscriptions` | ดูด้านล่าง | `201 { data: Subscription }` | 400, 404 plan |
| 👤 | หน้า `/report?month=YYYY-MM` *(P2, แทน CSV)* | — | รายงานสรุปเดือน A4 ให้เบราว์เซอร์บันทึกเป็น PDF (`print=1` เปิดหน้าต่างพิมพ์ให้) · ไม่ย้อนก่อนเดือนนี้ | redirect ไป /login |
| 👤 | `GET /api/subscriptions/:id` | — | `{ data: Subscription }` | 404 |
| 👤 | `PATCH /api/subscriptions/:id` | ฟิลด์ใดก็ได้จากตอนสร้าง + `status: "active"\|"cancelled"` | `{ data: Subscription }` | 400, 404 |
| 👤 | `DELETE /api/subscriptions/:id` | — | `204` (ลบกลุ่มหารที่ผูกไว้ด้วย — UI ต้องยืนยันก่อน) | 404 |

Body ของ `POST` (เปลี่ยนจากร่างแรก: ใช้ฟิลด์ `source` บอกชนิดให้ชัด แทนการเดาจากว่ามี `planId` หรือไม่):
```ts
{
  source: "catalog"; planId: number;                       // เลือกจากคลัง (แพ็กเกจและบริการต้องไม่ถูกซ่อน)
} | {
  source: "custom"; customName: string; customCategoryId: number;   // เพิ่มเอง
} & {
  price: number;                // บังคับ >= 0, <= 99999.99 — ฟอร์มเติมราคาแพ็กเกจให้ ผู้ใช้แก้ได้ (ราคาโปรฯ)
  billingCycle: "monthly" | "yearly";
  nextBillingDate: string;      // YYYY-MM-DD, >= วันนี้ (ไทย)
  trialEndsAt?: string | null;  // YYYY-MM-DD, "" = null
  paymentMethod?: string | null;// <= 100, "" = null
  note?: string | null;         // <= 500, "" = null
}
```
PATCH: ไม่มี `source` · รายการจากคลังเปลี่ยน `planId` ได้เฉพาะแพ็กเกจของบริการเดิม · รายการ custom แก้ได้แค่ `customName`/`customCategoryId` (ข้ามชนิดกันได้ 400) · `GET` คืน `nextBillingDate` ที่เลื่อนให้แล้วถ้าเลยวันมา (กันกรณีงานรายวันยังไม่รัน)
ยกเลิก = `PATCH { status: "cancelled" }` → server ตั้ง `cancelledAt` · กลับมาใช้ = `PATCH { status: "active", nextBillingDate }`

### 5.6 Dashboard & ปฏิทิน

| | Method + path | Response |
|---|---|---|
| 👤 | `GET /api/dashboard` | `{ data: { totals: { monthly, yearly, activeCount }, byCategory: { categoryId, name, monthly }[], upcoming: UpcomingItem[] } }` — upcoming = 7 วันข้างหน้ารวมวันนี้ เรียงตามวัน |
| 👤 | `GET /api/calendar?month=2026-10` | `{ data: { month: "2026-10", days: { date: string; items: UpcomingItem[] }[] } }` — ส่งเฉพาะวันที่มีรายการ |

```ts
type UpcomingItem = { subscriptionId: number; name: string; logoUrl: string | null;
                      date: string; amount: number; kind: "billing" | "trial_end" };
```

### 5.7 การแจ้งเตือน

| | Method + path | Request | Response | Error |
|---|---|---|---|---|
| 👤 | `GET /api/me/settings` | — | `{ data: { notifyEnabled, notifyDaysBefore } }` | — |
| 👤 | `PATCH /api/me/settings` | `{ notifyEnabled?: boolean, notifyDaysBefore?: 1\|3\|7 }` | เหมือน GET | 400 |
| 👤 | `POST /api/me/notifications/test` | — | `{ data: { sentTo: string, itemCount: number } }` | 429 (1 ครั้ง/นาที), 500 `EMAIL_FAILED` |
| 👤 | `GET /api/notifications` | query `unread=1?`, `limit?` (default 20) | `{ data: Notification[], meta: { unreadCount } }` เฉพาะ channel `in_app` | — |
| 👤 | `POST /api/notifications/:id/read` | — | `204` | 404 |
| 👤 | `POST /api/notifications/read-all` | — | `204` | — |
| 🔑 | `POST /api/cron/reminders` | — | `{ data: { rolled, sent, skipped, failed } }` | 401 |

**อีเมลทดสอบ (US-E4):** ส่งสรุปรายการที่จะตัดเงิน/หมดทดลองใน 30 วันข้างหน้าของผู้ใช้คนนั้นทันที ไม่สนการตั้งค่าล่วงหน้า บันทึกเป็น `type = 'test'` (ไม่กระทบตัวกันส่งซ้ำ) ถ้าไม่มีรายการเลยก็ยังส่ง พร้อมข้อความ "ยังไม่มีรายการที่จะตัดเงินใน 30 วัน"

**เปลี่ยนรหัสผ่าน** (หน้าตั้งค่า: ยืนยันรหัสเดิมก่อน ช่องรหัสใหม่จึงกรอกได้)

| | Method + Path | Body | Response | Error |
|---|---|---|---|---|
| 👤 | `POST /api/me/password/verify` | `{ currentPassword }` | `200 { data: { verified: true } }` | 400 `fields.currentPassword`, 429 (ผิด 5 ครั้ง/15 นาที/บัญชี — นับร่วมกับข้อล่าง) |
| 👤 | `PATCH /api/me/password` | `{ currentPassword?, newPassword, confirmPassword }` (`currentPassword` ไม่ต้องส่งถ้าบัญชีเข้าด้วย Google อย่างเดียว) | `200` + cookie ใหม่ · เพิ่ม `session_version` = เครื่องอื่นหลุด | 400 (รหัสเดิมผิด / ใหม่ < 8 ตัว / สองช่องไม่ตรง / ซ้ำของเดิม), 429 |

**แจ้งปัญหา / คำแนะนำ** (ฟอร์มในหน้าตั้งค่า → หลังบ้าน `/admin/feedback`)

| | Method + Path | Body | Response | Error |
|---|---|---|---|---|
| 👤 | `POST /api/feedback` | `{ kind: "bug"\|"suggestion"\|"other", message }` | `201 { data: { id, kind, message, status, createdAt } }` | 400, 429 (เกิน 5 ครั้ง/ชั่วโมง/บัญชี) |

### 5.8 ตัวช่วยประหยัด *(P1)*

| | Method + path | Response |
|---|---|---|
| 👤 | `GET /api/savings` | `{ data: { subscriptionId, kind: "switch_yearly" \| "family_split", planId, members?: number, saveMonthly: number, saveYearly: number, message: string }[] }` |

แต่ละข้อมี `onSuggestedPlan` (ใช้แพ็กเกจที่เสนออยู่แล้วหรือไม่ — UI ใช้เลือกว่าจะพาไป "สร้างกลุ่มหาร" หรือ "เปลี่ยนแพ็กเกจ") · `switch_yearly`: บริการเดียวกันมีแพ็กเกจรายปีที่ (ราคารายปี / 12) < ราคารายเดือนที่จ่ายอยู่ · `family_split`: มีแพ็กเกจ `maxMembers > 1` → ส่วนต่อคน = ราคา / maxMembers เทียบกับที่จ่ายอยู่ · ไม่เสนอถ้าประหยัด < ฿1/เดือน

### 5.9 หารค่าบริการ *(P1)*

| | Method + path | Request | Response | Error |
|---|---|---|---|---|
| 👤 | `GET /api/groups` | — | `{ data: GroupSummary[] }` | — |
| 👤 | `POST /api/groups` | `{ subscriptionId, promptpayId, splitMode, members: { name, email?, amount? }[] }` (1–10 คน; `amount` บังคับเมื่อ custom) | `201 { data: GroupDetail }` | 400, 404, 409 `GROUP_EXISTS` |
| 👤 | `GET /api/groups/:id` | query `period?` (default เดือนนี้) | `{ data: GroupDetail }` | 404 |
| 👤 | `PATCH /api/groups/:id` | `{ promptpayId?, splitMode?, name? }` (เปลี่ยนเป็น equal → คำนวณใหม่ทุกคน) | `{ data: GroupDetail }` | 400, 404 |
| 👤 | `DELETE /api/groups/:id` | — | `204` | 404 |
| 👤 | `POST /api/groups/:id/members` | `{ name, email?, amount? }` | `201 { data: GroupDetail }` | 400, 404 |
| 👤 | `PATCH /api/groups/:id/members/:memberId` | `{ name?, email?, amount? }` | `{ data: GroupDetail }` | 400, 404 |
| 👤 | `DELETE /api/groups/:id/members/:memberId` | — | `{ data: GroupDetail }` (ลิงก์จ่ายเดิมใช้ไม่ได้ทันที) | 404 |
| 👤 | `PUT /api/groups/:id/payments` | `{ memberId, period: "YYYY-MM", status: "paid"\|"unpaid" }` | `{ data: GroupDetail }` | 400, 404 |
| 👤 | `POST /api/groups/:id/members/:memberId/remind` | — | `204` | 400 ไม่มีอีเมล, 429 (1 ครั้ง/วัน/คน) |

```ts
type GroupSummary = { id: number; name: string; subscription: { id: number; name: string; logoUrl: string | null };
                      total: number; memberCount: number; paidCount: number; period: string };
type GroupDetail = GroupSummary & {
  promptpayIdMasked: string;                 // 08x-xxx-1234 — ไม่ส่งเลขเต็มกลับ
  splitMode: "equal" | "custom"; ownerAmount: number;
  members: { id: number; name: string; email: string | null; amount: number;
             payUrl: string;                 // `${APP_URL}/pay/${token}`
             status: "paid" | "unpaid"; paidAt: string | null }[];
};
```

**ข้อจำกัดที่ตัดสินใจตอนทำ (วันที่ 7):** หารได้เฉพาะรายการ**รายเดือน**ที่ใช้งานอยู่ (รอบเก็บเงินเป็นเดือนปฏิทินตามเวลาไทย จึงไม่เข้ากับรายการรายปี) · PromptPay ID รับเฉพาะเบอร์มือถือ 06/08/09 และเลขบัตรประชาชนที่ check digit ถูก · ตอบกลับ API มีแต่เลขที่ mask แล้ว · `PUT payments` เป็น upsert บน unique (member, period) · เตือนสมาชิกได้วันละครั้ง (เก็บใน `member_payments.reminded_at`)

**เพิ่มหลังรีวิว (วันที่ 8):** แก้ราคารายการที่หารอยู่ → กลุ่มหารเท่ากันคำนวณยอดใหม่ในทรานแซกชันเดียวกัน, โหมดกำหนดเองที่ยอดสมาชิกรวมเกินราคาใหม่ → 400, เปลี่ยนเป็นรายปี → 400 · รายการถูกยกเลิก (หรือเจ้าของถูกระงับ) → หน้าจ่ายขึ้น "ไม่ต้องจ่ายแล้ว" ไม่มี QR และเตือนไม่ได้ (`GroupSummary.cancelled`) · สมาชิกยอด ฿0 ไม่แสดง QR · เตือนสมาชิกจำกัด 20 ฉบับ/วัน/เจ้าของ และ 1 ฉบับ/วัน/อีเมลผู้รับ (ลบแล้วเพิ่มใหม่ก็ไม่หลุด) · เพิ่ม/ลบสมาชิกล็อกแถวกลุ่ม (`SELECT … FOR UPDATE`) กันเกิน 10 คน

**เข้าสู่ระบบด้วย Google (เพิ่มวันที่ 8, ไม่บังคับ):** `GET /api/auth/google` (🌐) → Google (OAuth code + PKCE S256, state ใน cookie httpOnly 10 นาที) → `GET /api/auth/google/callback` (🌐) ตรวจ state, แลก code, ตรวจ `id_token` กับ JWKS ของ Google, รับเฉพาะ `email_verified` → หา/ผูก/สร้างบัญชีด้วย `users.google_sub` · ผูกกับบัญชีรหัสผ่านเดิม = ยกเลิกรหัสผ่าน + `session_version + 1` (กัน pre-hijacking) · รายละเอียดและการตั้งค่าใน docs/05-deploy.md

**Session (เพิ่มวันที่ 8):** JWT มี claim `sv` = `users.session_version` ตอนออก token · `getCurrentUser` เทียบกับ DB ทุกครั้ง · logout เพิ่ม `session_version` → token เก่าทุกใบ (ทุกเครื่อง) ใช้ไม่ได้ทันที · token ที่ไม่มี `sv` ถือเป็น 0 · คำค้น LIKE escape `% _ \` (`src/lib/like.ts`)

**หน้า `/pay/[token]` (🌐)** — Server Component ไม่มี API แยก: หา member จาก token (ไม่พบ → 404 ธรรมดา) แสดงชื่อเจ้าของกลุ่ม, บริการ, ยอดของสมาชิกคนนั้น, เดือน, QR (SVG สร้างฝั่ง server จาก `promptpay-qr` + `qrcode`), PromptPay ID แบบ mask และสถานะจ่ายแล้ว/ยัง · หน้านี้ใส่ `<meta name="robots" content="noindex">`

### 5.10 Admin 🛡

| Method + path | Request | Response | Error |
|---|---|---|---|
| `GET /api/admin/categories` | — | `{ data: (Category & { serviceCount })[] }` | — |
| `POST /api/admin/categories` | `{ name, slug, icon?, sortOrder? }` | `201 { data: Category }` | 400, 409 slug ซ้ำ (`VALIDATION_ERROR` + fields.slug) |
| `PATCH /api/admin/categories/:id` | ฟิลด์ใดก็ได้ | `{ data: Category }` | 400, 404 |
| `DELETE /api/admin/categories/:id` | — | `204` | 404, 409 `IN_USE` (มีบริการหรือ custom subscription ใช้อยู่) |
| `GET /api/admin/services` | `q?`, `category?` | `{ data: (ServiceSummary & { isActive, planCount, subscriberCount })[] }` รวมที่ซ่อน | — |
| `POST /api/admin/services` | `{ name, slug, categoryId, logoUrl?, websiteUrl?, cancelSteps: string, isActive? }` | `201 { data: ServiceDetail }` | 400 |
| `GET /api/admin/services/:id` | — | `{ data: ServiceDetail & { isActive, cancelStepsText } }` (plans รวมที่ซ่อน, `cancelStepsText` = ข้อความดิบสำหรับฟอร์มแก้) | 404 |
| `PATCH /api/admin/services/:id` | ฟิลด์ใดก็ได้ | `{ data: ServiceDetail }` | 400, 404 |
| `DELETE /api/admin/services/:id` | — | `204` | 404, **409 `IN_USE` message: "มีผู้ใช้ผูกบริการนี้อยู่ ซ่อนบริการแทนการลบ"** |
| `POST /api/admin/services/:id/plans` | `{ name, price, billingCycle, maxMembers?, isActive? }` | `201 { data: Plan }` | 400, 404 |
| `PATCH /api/admin/plans/:id` | ฟิลด์ใดก็ได้ — ถ้า `price` เปลี่ยน เขียน `price_history` ในทรานแซกชันเดียวกัน | `{ data: Plan }` | 400, 404 |
| `DELETE /api/admin/plans/:id` | — | `204` | 404, 409 `IN_USE` |
| `GET /api/admin/users` | `q?`, `page?` | `{ data: { id, name, email, role, status, loginMethods, createdAt }[], meta }` | — |
| `PATCH /api/admin/users/:id` | `{ status: "active"\|"suspended" }` **หรือ** `{ role: "user"\|"admin" }` (ทีละอย่าง) | `{ data: … }` · เปลี่ยน role = เพิ่ม `session_version` ของคนนั้น (role อยู่ใน token ต้องล็อกอินใหม่) | 400 ระงับตัวเอง/admin, เปลี่ยน role ตัวเอง, ตั้งบัญชีที่ถูกระงับเป็น admin · 404 |
| `DELETE /api/admin/users/:id` | — | `204` · ข้อมูลของบัญชีหายตาม FK CASCADE | 400 ลบตัวเอง/admin (ถอดสิทธิ์ก่อน) · 404 |
| `GET /api/admin/feedback` | `status?` คั่นด้วย `,` ได้ เช่น `acknowledged,in_progress`, `page?` | `{ data: { id, kind, message, status, reply, repliedAt, createdAt, user: { id, name, email } }[], meta }` | — |
| `PATCH /api/admin/feedback/:id` | `{ status?: "new"\|"read"\|"acknowledged"\|"in_progress"\|"resolved", reply?: string }` (อย่างน้อยหนึ่งช่อง) | `{ data: Feedback }` · มี `reply` = สถานะ "ใหม่" เลื่อนเป็น "อ่านแล้ว" · ตอบ หรือขยับไปขั้นใหม่ = สร้างแจ้งเตือน `feedback_reply` ที่กระดิ่งของผู้ส่ง 1 รายการ | 400, 404 |
| `GET /api/admin/dashboard` | — | ดูด้านล่าง | — |

```ts
type AdminDashboard = {
  totals: { users: number;               // role user ทั้งหมด
            activeSubscriptions: number;
            avgMonthlyPerUser: number;   // ผลรวม monthlyCost ของรายการ active / จำนวนผู้ใช้ที่มี ≥ 1 รายการ active
            emailsThisMonth: number };   // notifications channel=email status=sent เดือนปัจจุบัน (ไทย)
  topServices: { serviceId: number; name: string; count: number }[];   // 10 อันดับ จากรายการ active
  byCategory: { categoryId: number; name: string; count: number }[];
  newUsersDaily: { date: string; count: number }[];                     // 30 วันล่าสุด เติม 0 วันที่ไม่มี
  topSharedServices?: { serviceId: number; name: string; groups: number }[];  // P1
};
```

---

## 6. งานแจ้งเตือนรายวัน

**ที่รัน:** `src/instrumentation.ts` → `register()` เมื่อ `NEXT_RUNTIME === "nodejs"` และ `CRON_ENABLED=true` → `node-cron` ตั้งเวลา 08:00 Asia/Bangkok ให้ **`fetch` ไปที่ `POST /api/cron/reminders` ของตัวเอง** (พร้อม `CRON_SECRET`) และเรียกหนึ่งครั้ง 15 วินาทีหลังสตาร์ต (ตามงานที่พลาดตอนเครื่องปิด) · ที่ไม่เรียก `runReminders()` ตรง ๆ เพราะ instrumentation ไม่ควร import โมดูล `server-only`/DB และทางเดียวกันนี้ใช้กับ scheduler ภายนอกได้ทันที · มี flag `running` กันรันซ้อน · `api()` รับ `{ allowCrossOrigin: true }` เฉพาะ endpoint นี้ เพราะไม่มี header Origin

**`runReminders(today)`** (`server/services/reminders.ts`; `today` รับเป็นพารามิเตอร์เพื่อเทสได้)
1. **Roll** วันตัดเงินที่เลยแล้วตามกฎข้อ 3.3.2–3
2. **หาเป้าหมาย** ผู้ใช้ `active` + `notify_enabled` ที่มีรายการ active ซึ่ง
   - `billing_reminder`: `0 ≤ next_billing_date − today ≤ notify_days_before`
   - `trial_ending`: `trial_ends_at` อยู่ในช่วงเดียวกัน
   - ใช้ "ช่วง" ไม่ใช่ "เท่ากับพอดี" → เครื่องปิดไปหนึ่งวันก็ยังส่งตามได้
3. **กันซ้ำ:** `INSERT … (status 'pending') ON DUPLICATE KEY UPDATE id = id` บน unique `(user_subscription_id, type, due_date, channel)` → ถ้าแถวเดิมเป็น `sent` แล้วข้าม
4. **ส่ง** ทีละฉบับ (ไม่ต้องคิวสำหรับขนาดนี้) → สำเร็จ `status='sent'` / พลาด `status='failed', attempts+1` (รอบถัดไปลองใหม่จนครบ 3 ครั้ง) → สร้างแถว `in_app` คู่กันสำหรับกระดิ่ง
5. คืนตัวนับ `{ rolled, sent, skipped, failed }` และ log

**อีเมล** (HTML ภาษาไทย + text fallback): ชื่อบริการ, ยอดเงิน `฿419.00`, วันตัดเงินแบบไทย `อ. 13 ต.ค. 2569`, ปุ่ม "ดูวิธียกเลิก" → `/services/[slug]#cancel` (custom → `/subscriptions/[id]/edit`) · หัวเรื่อง trial: "จะเริ่มเก็บเงินแล้ว ยกเลิกตอนนี้ถ้าไม่ใช้ต่อ" · Gmail ส่งได้ราว 500 ฉบับ/วัน เกินพอ

**วันที่:** ห้ามพึ่ง timezone ของเครื่อง (Windows ไม่สน `TZ` เสมอไป) — `todayInBangkok()` ใช้ `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' })` ทุกจุดที่ตัดสินว่า "วันนี้" คือวันไหน

---

## 7. Environment variables (`.env.example`)

| ตัวแปร | ตัวอย่าง | ใช้ที่ |
|---|---|---|
| `DATABASE_URL` | `mysql://tadyang:tadyang@localhost:3307/tadyang` (3307 เพราะ XAMPP จอง 3306) | db, drizzle-kit |
| `SESSION_SECRET` | สุ่ม ≥ 32 ตัวอักษร (`openssl rand -base64 48`) | JWT |
| `APP_URL` | `http://localhost:3000` | ลิงก์ในอีเมล, ลิงก์จ่ายเงิน, ตรวจ Origin |
| `SMTP_HOST` / `SMTP_PORT` | `smtp.gmail.com` / `465` | mailer |
| `SMTP_USER` / `SMTP_PASS` | อีเมลโปรเจกต์ / App Password 16 ตัว | mailer |
| `MAIL_FROM` | `"ตัดยัง? <tadyang.project@gmail.com>"` | mailer |
| `MAIL_TRANSPORT` | `smtp` \| `console` | `console` = พิมพ์อีเมลลง log แทนส่งจริง (dev/test) |
| `CRON_ENABLED` | `true` | instrumentation (ปิดตอนรันเทส) |
| `CRON_SECRET` | สุ่ม | `/api/cron/reminders` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — | `scripts/seed.ts` เท่านั้น |

`.env` อยู่ใน `.gitignore` และ**ไม่ใส่ในไฟล์ส่งงาน** (docs/01 §9)

---

## 8. Hosting

- **หลัก (demo):** รันบนเครื่อง `docker compose up -d db` → `npm run db:migrate && npm run db:seed` → `npm run build && npm start` (ใช้ production build ตอน demo เร็วกว่าและ cron ทำงานเหมือนกัน)
- **ทางเลือก (ถ้ามีเวลา):** Railway / Render (Node server ค้างอยู่ cron ทำงานได้) + MySQL บน cloud · ถ้าไป Vercel serverless node-cron **ใช้ไม่ได้** ต้องเปลี่ยนเป็น Vercel Cron ยิง `POST /api/cron/reminders`
- **ไฟล์ SQL ส่งงาน:** `scripts/export-sql.sh` = `mysqldump` (schema + ข้อมูลตัวอย่าง, ไม่มีผู้ใช้จริง) → `submission/tadyang.sql`

---

## 9. ความเสี่ยงและทางลด

| # | ความเสี่ยง | โอกาส/ผลกระทบ | ทางลด |
|---|---|---|---|
| 1 | Gmail ไม่ให้ส่ง (ยังไม่เปิด 2FA / App Password ผิด) ในวัน demo | กลาง/สูง | ตั้ง Gmail โปรเจกต์**วันที่ 2** และส่งอีเมลจริงหนึ่งฉบับให้ได้ก่อนเขียนฟีเจอร์ · มี `MAIL_TRANSPORT=console` สำรอง |
| 2 | QR พร้อมเพย์สแกนแล้วไม่ขึ้นชื่อ/ยอดผิด | กลาง/สูง (ไฮไลต์ของ demo) | unit test payload เทียบค่าที่รู้คำตอบ + **สแกนด้วยแอปธนาคารจริงตอนเช้าวันที่ 7** ก่อนทำ UI กลุ่ม |
| 3 | cron ไม่รันเพราะเซิร์ฟเวอร์ไม่ได้เปิดตอน 08:00 | สูง/ต่ำ | รันตอนสตาร์ต + ใช้ "ช่วง" ไม่ใช่ "วันพอดี" + ปุ่มอีเมลทดสอบสำหรับ demo |
| 4 | วันสิ้นเดือน/ปีอธิกสุรทินทำวันตัดเงินเพี้ยน | กลาง/กลาง | `billing_anchor_day` + unit test 31 ม.ค., 29 ก.พ., 30/31 |
| 5 | Next.js 16 API ต่างจากบทเรียนออนไลน์ (`proxy.ts`, async params) | สูง/กลาง | อ่าน `node_modules/next/dist/docs/` ก่อนเขียนไฟล์ระดับ framework |
| 6 | เครื่องสมาชิกใช้ XAMPP (MariaDB 10.4) ไม่ใช่ MySQL 8 | กลาง/กลาง | ใช้ Docker เป็นหลัก · schema ใช้เฉพาะ ENUM/DECIMAL/DATE/TEXT ธรรมดา ไม่ใช้ JSON column, CTE ใน migration, หรือ functional index |
| 7 | เลขบัตรประชาชนเจ้าของกลุ่มรั่วผ่านหน้าจ่ายเงิน | กลาง/สูง | แสดงแบบ mask · token เดาไม่ได้ + `noindex` · แนะนำใน UI ให้ใช้เบอร์โทร (QR ต้องมีเลขอยู่แล้วโดยธรรมชาติ) |
| 8 | เวลาไม่พอ | สูง/สูง | กฎเหล็กใน docs/01: P0 ให้เสร็จวันที่ 6 · ตัดตัวช่วยประหยัดก่อน แล้วค่อยตัดหารค่าบริการ |
| 9 | ราคาในคลังผิด/เก่า | สูง/ต่ำ | เก็บจากเว็บทางการตอนทำ seed วันที่ 3 และแสดง "อัปเดตข้อมูลล่าสุด" ทุกบริการ |

---

## 10. ADR (การตัดสินใจสำคัญ)

**ADR-001 · Next.js monolith** — frontend + API อยู่ในแอปเดียว · *เพราะ* ทีม 3 คน 9 วัน ต้องการคำสั่งรันเดียว ไม่มี CORS · *แลกกับ* ถ้าวันหนึ่งต้องมีแอปมือถือก็ยังใช้ REST ชุดเดียวกันได้ จึงไม่เสียอะไร

**ADR-002 · Drizzle แทน Prisma** — *เพราะ* Prisma เพิ่งเปลี่ยนวิธีต่อ DB ใน v7 และ v8 ยังเป็น RC การเจอ breaking change กลางโปรเจกต์ 9 วันคือความเสี่ยงที่ไม่จำเป็น Drizzle ได้ไฟล์ migration เป็น `.sql` ล้วน ใช้ประกอบงานส่งได้ · *แลกกับ* Drizzle ไม่มี down migration → ถ้าพลาดให้เขียน migration ใหม่แก้ (ช่วงพัฒนาใช้ `db:reset` ล้างแล้ว seed ใหม่ได้)

**ADR-003 · Session JWT เขียนเอง** — *เพราะ* ใช้แค่ email/password ไม่มี OAuth ใน P0 และต้องอธิบายตอนนำเสนอได้ · *แลกกับ* ต้องรับผิดชอบรายละเอียดความปลอดภัยเอง → ปิดด้วยการโหลดผู้ใช้จาก DB ทุก API (ระงับบัญชีมีผลทันที) และ security-auditor ตรวจวันที่ 8 · ถ้าทำ "ล็อกอินด้วย Google" (P2) ค่อยพิจารณา Auth.js

**ADR-004 · node-cron ใน process เดียวกับเว็บ** — *เพราะ* demo รันบนเครื่อง ไม่อยากให้ทุกคนตั้ง Task Scheduler · *แลกกับ* ใช้ไม่ได้บน serverless → endpoint `POST /api/cron/reminders` ทำให้เปลี่ยนไปใช้ scheduler ภายนอกได้โดยไม่แก้ logic

**ADR-005 · ราคาผู้ใช้เป็น snapshot + anchor day** — *เพราะ* ราคาที่ผู้ใช้จ่ายจริงไม่จำเป็นต้องเท่าราคาในคลัง และวันตัดเงินต้องไม่ไหลเมื่อผ่านเดือนสั้น · *แลกกับ* ต้องมีป้ายบอกเมื่อราคาในคลังเปลี่ยน (ได้ฟรีจาก `catalogPrice`)

**ADR-006 · REST สำหรับการแก้ข้อมูล, Server Component อ่านตรง** — *เพราะ* contract ชัดให้ frontend/backend ทำคู่ขนาน และเทสด้วย curl ได้ · ไม่ใช้ Server Actions ในรอบนี้เพื่อให้มีรูปแบบเดียวทั้งทีม

---

## 11. ส่งต่อให้วันที่ 2

- **devops-engineer:** scaffold Next.js 16 + TS + Tailwind 4 + ESLint/Prettier, `docker-compose.yml` (MySQL 8.4 + phpMyAdmin), `drizzle.config.ts`, `.env.example` ตามข้อ 7, สคริปต์ `db:generate / db:migrate / db:seed / db:reset` · DoD: `npm run dev` ขึ้น และหน้า `/api/health` query `SELECT 1` ผ่าน
- **ui-ux-designer:** `docs/03-design.md` ยึดระบบ dark + vivid + glass ที่เลือกไว้แล้ว (พื้น `#0B0B0F`, การ์ดแก้ว, น้ำเงิน `#3B4CF5` / ส้ม `#FF8A3D` / เขียวมะนาว `#C8F169`) ตรวจ contrast WCAG AA ของตัวอักษรบนการ์ดแก้วด้วย
- **test-planner:** `docs/04-test-plan.md` — unit test ข้อ 3.3 ทั้ง 7 ข้อ + reminders + PromptPay payload, integration test สิทธิ์ตาม US-A3, E2E ตามลำดับ demo ใน docs/01 §8
- **ทีม:** สร้าง Gmail โปรเจกต์ + App Password (docs/01 §10 ข้อ 3)
