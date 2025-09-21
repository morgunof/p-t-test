// backend/src/server.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import tonconnectRoutes from './routes/tonconnect.js';

import { loadDeploy, buildTonConnectDeploy } from './ton/deploy.js'; // ← убедись, что .js

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

await app.register(cors, { origin: process.env.CORS_ORIGIN || '*' });
await app.register(tonconnectRoutes, { prefix: '/api/tonconnect' });


app.get('/api/health', async () => ({ ok: true }));


// ... остальные маршруты без изменений ...

const port = Number(process.env.PORT ?? 8080);
await app.listen({ host: '0.0.0.0', port });
