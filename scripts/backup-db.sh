#!/usr/bin/env bash
# สำรองฐานข้อมูล production เป็น backups/tadyang-YYYYmmdd-HHMM.sql.gz และเก็บย้อนหลัง 14 วัน
# ใช้บน server (โฟลเดอร์เดียวกับ docker-compose.prod.yml): bash scripts/backup-db.sh
# ตั้งให้รันทุกคืน: crontab -e → 30 3 * * * cd /opt/tadyang && bash scripts/backup-db.sh >> backups/backup.log 2>&1
set -euo pipefail  # mysqldump พังต้องไม่ได้ไฟล์ .gz เปล่าที่ดูเหมือนสำเร็จ

mkdir -p backups
file="backups/tadyang-$(date +%Y%m%d-%H%M).sql.gz"
# รหัส root อ่านจาก env ภายใน container เอง ไม่ผ่าน command line ของ host
docker compose -f docker-compose.prod.yml exec -T db sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --no-tablespaces --default-character-set=utf8mb4 tadyang' \
  | gzip > "$file"
echo "สำรองแล้ว: $file"
find backups -name 'tadyang-*.sql.gz' -mtime +14 -delete
