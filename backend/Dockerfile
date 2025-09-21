# backend/Dockerfile
FROM node:20-bullseye AS builder
WORKDIR /app

RUN apt-get update -y && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./tsconfig.json
COPY prisma ./prisma
COPY src ./src
COPY tact ./tact 

# Генерим prisma + билдим бэкенд
RUN npx prisma generate && npm run build

# ⚙️ Компилируем Tact биндинги (TypeScript -> JS)
# ВАЖНО: вход — файл, сгенерённый тактом: build/swap_AtomicSwap.ts
RUN npx tsc tact/swap_AtomicSwap.ts \
      --outDir dist/tact \
      --module NodeNext \
      --moduleResolution NodeNext \
      --target ES2020 \
      --esModuleInterop

# ─────────────────────────────────────────
FROM node:20-bullseye AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Берём готовые node_modules из builder (там уже prisma client)
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# и js-биндинги Tact
COPY --from=builder /app/dist/tact ./dist/tact

# контрактные артефакты (code.boc/abi/pkg) подмонтированы томом ./build:/app/build
EXPOSE 8080
CMD ["node", "dist/server.js"]
