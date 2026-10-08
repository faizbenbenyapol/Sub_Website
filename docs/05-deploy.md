# ตัดยัง? — Deploy บน Ubuntu server ด้วย Docker

```
อินเทอร์เน็ต ──443/80──▶ Caddy (HTTPS อัตโนมัติ) ──▶ app (Next.js :3000) ──▶ db (MySQL 8.4)
```

- เปิดสู่ภายนอกแค่พอร์ต 80/443 ของ Caddy · แอปและ MySQL อยู่ในเครือข่ายภายในของ compose
- container แอปรัน migration ที่ยังค้างให้เองทุกครั้งก่อนเปิดเว็บ (`scripts/migrate.ts`) — อัปเดตเวอร์ชันแล้ว `up -d --build` ได้เลย
- งานแจ้งเตือน 08:00 รันใน container แอปเอง (`CRON_ENABLED=true`) เรียกตัวเองผ่าน `http://localhost:3000` ไม่อ้อมผ่านโดเมน
- `APP_URL` เป็น `https://` → cookie ตั้ง `Secure` และส่ง HSTS ให้อัตโนมัติ

## 1. เตรียม server (ครั้งเดียว)

1. **DNS:** ตั้ง A record ของโดเมน (เช่น `tadyang.example.com`) ชี้ไปที่ IP ของ server แล้วรอจน `ping tadyang.example.com` ได้ IP ถูก
2. **Docker:** ติดตั้งตามคู่มือทางการ https://docs.docker.com/engine/install/ubuntu/ (ได้ทั้ง Docker Engine และ `docker compose`)
3. **Firewall:** เปิดเฉพาะ SSH + เว็บ

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw allow 443/udp
sudo ufw enable
```

> Docker เปิดพอร์ตที่ประกาศใน compose ข้าม ufw ได้ — ไฟล์ `docker-compose.prod.yml` จึงประกาศ `ports` ไว้แค่ที่ Caddy ห้ามเพิ่ม `ports` ให้ `db` หรือ `app`

## 2. ติดตั้งครั้งแรก

```bash
sudo mkdir -p /opt/tadyang && sudo chown $USER /opt/tadyang
git clone https://github.com/faizbenbenyapol/Sub_Website.git /opt/tadyang
cd /opt/tadyang
cp .env.production.example .env
nano .env                       # เติมค่าตามข้อ 3
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f app   # รอเห็น "migrate เสร็จ" และ "Ready"
```

ใส่ข้อมูลเริ่มต้น (หมวด + 18 บริการ + บัญชี admin จาก `ADMIN_EMAIL` / `ADMIN_PASSWORD` ใน `.env`) — รันซ้ำได้ ไม่สร้างของซ้ำ:

```bash
docker compose -f docker-compose.prod.yml exec app npx tsx scripts/seed.ts
```

เช็กทุกอย่างในคำสั่งเดียว (ต่อ DB, migration, ข้อมูลเริ่มต้น, ล็อกอิน Gmail จริงโดยไม่ส่งเมล, ค่า Google + redirect URI ที่ต้องลงทะเบียน):

```bash
docker compose -f docker-compose.prod.yml exec app npx tsx scripts/preflight.ts
```

> ข้อ "เปิด APP_URL ไม่ได้" ที่รันจากใน container อาจขึ้นเตือนบน server ที่เรียกโดเมนตัวเองไม่ได้ — ให้ลองเปิดจากเบราว์เซอร์แทน

เปิด `https://โดเมน/api/health` ต้องได้ `{"data":{"status":"ok","db":"ok"}}` · ครั้งแรก Caddy ใช้เวลาขอใบรับรองไม่กี่วินาที

## 3. ค่าใน `.env` บน server

| ตัวแปร | ค่า |
|---|---|
| `DOMAIN` | `tadyang.example.com` (ไม่มี `https://`) |
| `APP_URL` | `https://tadyang.example.com` — ลิงก์ในอีเมล ลิงก์จ่ายเงิน และ redirect ของ Google ใช้ค่านี้ |
| `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD` | สุ่มใหม่ ใช้แค่ `A-Z a-z 0-9` |
| `SESSION_SECRET`, `CRON_SECRET` | สุ่มใหม่ ≥ 32 ตัว (ห้ามใช้ค่าเดียวกับเครื่องพัฒนา) |
| `MAIL_TRANSPORT=smtp`, `SMTP_*`, `MAIL_FROM` | Gmail App Password (README หัวข้ออีเมลแจ้งเตือน) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ข้อ 4 — เว้นว่างได้ ปุ่ม Google จะไม่แสดง |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | ใช้ตอน seed เท่านั้น |

สุ่มค่าลับ: `openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 48`

> `APP_URL` ถูกอ่านตอน build ด้วย (เปิด HSTS) — เปลี่ยนโดเมนแล้วต้อง `up -d --build` ใหม่

## 4. เข้าสู่ระบบด้วย Google

1. เข้า https://console.cloud.google.com → สร้างโปรเจกต์ใหม่ (เช่น `tadyang`)
2. **APIs & Services → OAuth consent screen** (Google Auth Platform)
   - User type: **External** · ชื่อแอป `ตัดยัง?` · อีเมลติดต่อ · โดเมน `tadyang.example.com`
   - Scopes: `openid`, `email`, `profile` เท่านั้น (ไม่ต้องให้ Google ตรวจแอป)
   - ตอนเป็นสถานะ **Testing** ล็อกอินได้เฉพาะอีเมลใน *Test users* → ใช้จริงให้กด **Publish app** เป็น *In production*
3. **Credentials → Create credentials → OAuth client ID** → Application type **Web application**
   - **Authorized redirect URIs:** `https://tadyang.example.com/api/auth/google/callback` (ต้องตรงกับ `APP_URL` ทุกตัวอักษร)
   - ถ้าจะลองบนเครื่องพัฒนาเพิ่ม `http://localhost:3000/api/auth/google/callback` (Google ยอม http เฉพาะ localhost)
4. คัดลอก Client ID / Client secret ใส่ `.env` → `docker compose -f docker-compose.prod.yml up -d`

พฤติกรรม:

- ผู้ใช้ใหม่ได้บัญชีที่ไม่มีรหัสผ่าน **เปิดแจ้งเตือนทางอีเมล 3 วันล่วงหน้าให้ทันที** ส่งไปที่อีเมล Google (ที่ Google ยืนยันแล้ว) — ไม่ต้องตั้งค่าอะไร
- อีเมลที่เคยสมัครด้วยรหัสผ่านไว้ → ผูกเข้าบัญชีเดิม (รายการไม่หาย) และ**ยกเลิกรหัสผ่านเดิม + ออกจากระบบทุกเครื่อง** เพราะการสมัครด้วยรหัสผ่านไม่ได้ยืนยันว่าเป็นเจ้าของอีเมลจริง (กันคนสมัครอีเมลของคนอื่นดักไว้ก่อน)
- ระบุตัวด้วย `sub` ของ Google ไม่ใช่อีเมล — ผู้ใช้เปลี่ยนอีเมลใน Google ก็ยังเข้าบัญชีเดิม
- อีเมลที่ Google ยังไม่ยืนยัน / บัญชีที่ถูกระงับ → กลับหน้า login พร้อมข้อความ

## 5. อัปเดตเวอร์ชัน

```bash
cd /opt/tadyang
bash scripts/backup-db.sh       # สำรองก่อนทุกครั้ง
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## 6. สำรองและกู้ข้อมูล

```bash
bash scripts/backup-db.sh                          # → backups/tadyang-YYYYmmdd-HHMM.sql.gz (เก็บ 14 วัน)
crontab -e                                         # ทุกคืนตี 3 ครึ่ง:
# 30 3 * * * cd /opt/tadyang && bash scripts/backup-db.sh >> backups/backup.log 2>&1
```

กู้คืน (ทับข้อมูลปัจจุบัน):

```bash
gunzip -c backups/tadyang-YYYYmmdd-HHMM.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot tadyang'
```

ควรคัดลอกโฟลเดอร์ `backups/` ออกไปเก็บนอก server ด้วย (เช่น Google Drive) — ถ้า server พังทั้งเครื่องจะได้ไม่หายพร้อมกัน

## 7. ดูสถานะ / แก้ปัญหา

| อาการ | ดูที่ |
|---|---|
| เว็บเข้าไม่ได้ | `docker compose -f docker-compose.prod.yml ps` ทุกตัวต้อง `Up` · app ต้อง `healthy` |
| HTTPS ไม่ขึ้น | `... logs caddy` — DNS ยังไม่ชี้มา หรือพอร์ต 80/443 ถูกปิด |
| แอปไม่ขึ้น | `... logs app` — ค่าใน `.env` ขาด (บอกชื่อตัวแปร) หรือ DB ยังไม่พร้อม |
| ไม่ได้อีเมลเตือน | `... logs app \| grep -E "cron\|reminders"` — ดูตัวนับ `sent/failed` |
| Google: `redirect_uri_mismatch` | URI ใน Console ไม่ตรงกับ `APP_URL` + `/api/auth/google/callback` |
| Google: ล็อกอินไม่ได้ทั้งที่ตั้งครบ | แอปยังเป็น *Testing* และอีเมลไม่อยู่ใน Test users |

ทดสอบ stack นี้แล้วบนเครื่อง Windows (Docker Desktop) ด้วย `DOMAIN=localhost`: build โดยไม่มี DB, migrate ครั้งแรกและตอนอัปเดต, seed, HTTPS ผ่าน Caddy, redirect HTTP→HTTPS, HSTS, cookie `Secure`, ล็อกอิน + API admin หลัง proxy, cron ตอนเปิดเครื่อง, backup — **ยังไม่ได้ทดสอบบน Ubuntu จริงและยังไม่ได้ล็อกอินกับ Google จริง** (ต้องใช้ Client ID ของโปรเจกต์)
