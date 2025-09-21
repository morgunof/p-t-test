// backend/src/routes/tonconnect.ts
import { FastifyInstance } from 'fastify';
import { loadDeploy, buildTonConnectDeploy } from '../ton/deploy.js';

export default async function tonconnectRoutes(fastify: FastifyInstance) {
  fastify.get('/deploy', async (_req, reply) => {
    try {
      const { address, state_init } = await loadDeploy();
      const payload = buildTonConnectDeploy(address, state_init, 0.05);
      return payload;
    } catch (e: any) {
      reply.code(400);
      return { error: String(e?.message ?? e) };
    }
  });
}
