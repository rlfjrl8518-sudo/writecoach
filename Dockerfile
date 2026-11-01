# WriteCoach — Cloud Run 이미지 (Next.js standalone)
# NEXT_PUBLIC_* 값은 빌드 시점에 번들에 들어간다. scripts/gcp/deploy.sh 가 빌드 직전에
# .env.production(NEXT_PUBLIC_* 만)을 만들어 컨텍스트에 넣고, 끝나면 지운다.

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001 -G nodejs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# 매시 푸시 크론 (Cloud Run Job writecoach-push: node scripts/push-cron.mjs) — standalone node_modules 를 그대로 쓴다
COPY --from=builder --chown=nextjs:nodejs /app/scripts/push-cron.mjs ./scripts/push-cron.mjs
USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
