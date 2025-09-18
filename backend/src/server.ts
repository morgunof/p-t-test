import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
await app.register(cors, { origin: process.env.CORS_ORIGIN || '*' });

app.get('/api/health', async () => ({ ok: true }));

app.get('/api/offers', async () => {
  const list = await prisma.offer.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  return { items: list };
});

app.post('/api/offers', async (req, reply) => {
  const body: any = req.body || {};
  const offer = await prisma.offer.create({
    data: {
      parentId: body.parentId ?? null,
      maker: body.maker,
      takerAllowed: body.takerAllowed,
      offeredKind: body.offeredKind,
      offeredContract: body.offeredContract,
      offeredTokenId: body.offeredTokenId,
      offeredAmountTon: body.offeredAmountTon,
      wantedKind: body.wantedKind,
      wantedContract: body.wantedContract,
      wantedTokenId: body.wantedTokenId,
      wantedAmountTon: body.wantedAmountTon,
      feeBps: body.feeBps ?? Number(process.env.FEE_BPS_DEFAULT || 200),
      deadline: new Date(Date.now() + (Number(process.env.DEADLINE_DEFAULT_HOURS||24))*3600*1000),
    }
  });
  return { id: offer.id };
});

const port = Number(process.env.PORT || 8080);
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
