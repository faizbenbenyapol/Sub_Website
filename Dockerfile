# image production ของตัดยัง? — ใช้กับ docker-compose.prod.yml (ดู docs/05-deploy.md)
# build:  docker compose -f docker-compose.prod.yml build
# รัน next start ปกติ (ไม่ใช่ standalone) เพราะ container ต้องรัน migration และ seed ด้วย tsx ได้

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS build
WORKDIR /app
# APP_URL ถูกใช้ตอน build ใน next.config.ts (เปิด HSTS เมื่อเป็น https) — ต้องเป็นค่าจริงของ server
ARG APP_URL
# ค่าอื่นเป็นค่าหลอกให้ src/server/env.ts ผ่านตอน build เท่านั้น ค่าจริงมาจาก .env ตอนรัน
ENV APP_URL=$APP_URL \
    DATABASE_URL=mysql://build:build@localhost:3306/build \
    SESSION_SECRET=build-time-placeholder-not-used-at-runtime \
    CRON_SECRET=build-time-placeholder \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    CRON_BASE_URL=http://localhost:3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# --chown ตอน COPY แทน RUN chown -R ทีหลัง (ซึ่งจะก๊อป .next ทั้งก้อนซ้ำอีกชั้น)
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts /app/tsconfig.json ./
# migration + สคริปต์ seed/export ใช้ schema และ lib จาก src
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src ./src
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npx tsx scripts/migrate.ts && npx next start -H 0.0.0.0 -p 3000"]
