FROM node:20-bookworm-slim
WORKDIR /app

# системные зависимости (openssl для prisma, curl для отладки)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# зависимости npm (включая devDeps)
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm install

# prisma client и tsconfig
COPY tsconfig.json ./
COPY prisma ./prisma
RUN npx prisma generate

# исходники и сборка
COPY src ./src
RUN npm run build

ENV PORT=8080
EXPOSE 8080

CMD ["node","dist/server.js"]
