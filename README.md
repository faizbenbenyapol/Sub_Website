# ตัดยัง?

รวม subscription ที่สมัครไว้ เตือนทางอีเมลก่อนตัดเงิน และหารค่า Family plan กับเพื่อนด้วย QR พร้อมเพย์

Stack: Next.js 16 · TypeScript · Tailwind CSS 4 · MySQL 8.4 · Drizzle ORM — รายละเอียดใน [docs/02-architecture.md](docs/02-architecture.md)

## ตั้งเครื่องครั้งแรก

ต้องมี Node.js 24 ขึ้นไป และ Docker Desktop (เปิดไว้)

```bash
npm install
cp .env.example .env          # แล้วเติม SESSION_SECRET, CRON_SECRET (คำสั่งสุ่มอยู่ในไฟล์)
npm run db:up                 # MySQL ที่พอร์ต 3307 + phpMyAdmin ที่ http://localhost:8080
npm run dev                   # http://localhost:3000
```

เช็กว่าเว็บต่อฐานข้อมูลได้: เปิด http://localhost:3000/api/health ต้องได้ `{"data":{"status":"ok","db":"ok"}}`

## คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รันเว็บโหมดพัฒนา |
| `npm run check` | lint + typecheck + unit test (รันก่อนส่งงานทุกครั้ง) |
| `npm run format` | จัดรูปแบบโค้ดด้วย Prettier |
| `npm run db:generate` | สร้างไฟล์ migration `.sql` จาก `src/db/schema.ts` |
| `npm run db:migrate` | รัน migration กับฐานข้อมูลใน `.env` |
| `npm run db:studio` | ดูข้อมูลผ่าน Drizzle Studio |

## เอกสาร

1. [Requirements และแผนรายวัน](docs/01-requirements.md)
2. [Architecture, data model, API contract](docs/02-architecture.md)
3. [Design system](docs/03-design.md)
4. [Test plan](docs/04-test-plan.md)
