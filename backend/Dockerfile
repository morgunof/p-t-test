# backend/Dockerfile (Debian slim)
FROM node:20-bullseye-slim
WORKDIR /app

# полезное
RUN apt-get update -y && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

# deps
COPY package*.json ./
RUN npm install

# конфиги и исходники
COPY tsconfig.json ./tsconfig.json
COPY prisma ./prisma
COPY src ./src

# prisma client + TS build
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/server.js"]
