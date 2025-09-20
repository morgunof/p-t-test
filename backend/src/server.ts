import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { loadDeploy, buildTonConnectDeploy } from './ton/deploy.js';

function toJSONSafe(v: any): any {
  if (typeof v === 'bigint') return v.toString();
  if (Array.isArray(v)) return v.map(toJSONSafe);
  if (v && typeof v === 'object') {
    const out: any = {};
    for (const k of Object.keys(v)) out[k] = toJSONSafe(v[k]);
    return out;
  }
  return v;
}


const app = Fastify({ logger: true });
const prisma = new PrismaClient();

app.setSerializerCompiler(() => {
  return (data: any) =>
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
});

await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
await app.register(cors, { origin: process.env.CORS_ORIGIN || '*' });

app.get('/api/health', async () => ({ ok: true }));

app.get('/api/offers', async () => {
  const list = await prisma.offer.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  return toJSONSafe({ items: list });
});

app.post('/api/offers', async (req, reply) => {
  const body: any = req.body || {};
  const offer = await prisma.offer.create({
    data: {
      parentId: body.parentId ?? null,
      maker: body.maker,
      takerAllowed: body.takerAllowed ?? null,
      offeredKind: body.offeredKind,
      offeredContract: body.offeredContract ?? null,
      offeredTokenId: body.offeredTokenId ?? null,
      offeredAmountTon: body.offeredAmountTon ?? null,
      wantedKind: body.wantedKind,
      wantedContract: body.wantedContract ?? null,
      wantedTokenId: body.wantedTokenId ?? null,
      wantedAmountTon: body.wantedAmountTon ?? null,
      feeBps: body.feeBps ?? Number(process.env.FEE_BPS_DEFAULT || 200),
      deadline: new Date(Date.now() + (Number(process.env.DEADLINE_DEFAULT_HOURS||24))*3600*1000),
    }
  });
  return toJSONSafe({ id: offer.id });
});

const port = Number(process.env.PORT || 8080);
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

// --- TonConnect demo payloads (stubs) ---
// Эти ручки демонстрируют как фронту отдавать payloads для Tonkeeper.
// Чуть позже заменим на реальные body под методы контракта (createOffer, depositTon, executeSwap).

function buildTonTransfer(to: string, amountTon: number, payloadComment?: string) {
  // TonConnect принимает amount в нанотонах строкой
  const amountNano = BigInt(Math.floor(amountTon * 1e9)).toString();
  // payload как простой текстовый комментарий (в base64), пока без ABI body
  const payload = payloadComment ? Buffer.from(payloadComment, "utf-8").toString("base64") : undefined;

  return {
    valid_until: Math.floor(Date.now() / 1000) + 5 * 60,
    messages: [
      {
        address: to,
        amount: amountNano,
        payload: payload ? `te6ccgEBAwEAEwAA${payload}` : undefined // префикс для text-comment (кошелёк поймёт)
      }
    ]
  };
}

app.get('/api/tonconnect/deposit-demo', async () => {
  const contract = process.env.CONTRACT_ADDRESS || ''; // когда задеплоим — подставим адрес
  // пока дадим возможность кидать 0.1 TON на контракт как "депозит" (заглушка)
  return buildTonTransfer(contract, 0.1, 'deposit demo (mock)');
});

app.get('/api/tonconnect/execute-demo', async () => {
  const contract = process.env.CONTRACT_ADDRESS || '';
  // "выполнение" — просто нулевой перевод с комментом; позже тут будет реальный body для executeSwap
  return buildTonTransfer(contract, 0.01, 'execute demo (mock)');
});

app.get('/api/tonconnect/setfee-demo', async () => {
  const contract = process.env.CONTRACT_ADDRESS || '';
  // Эмулируем set_fee_receiver: маленький перевод с комментом — чтобы проверить путь в Tonkeeper
  return buildTonTransfer(contract, 0.01, 'set_fee_receiver (mock)');
});



app.get('/api/tonconnect/deploy', async () => {
  const { address, state_init } = loadDeploy();
  return buildTonConnectDeploy(address, state_init, 0.05);
});

