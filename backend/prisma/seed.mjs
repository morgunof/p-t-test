// backend/prisma/seed.mjs
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Добавим несколько простых офферов (минимальные поля, которые точно есть)
  const offers = [
    { maker: 'alice', offeredKind: 'NFT', wantedKind: 'TON', feeBps: 200 },
    { maker: 'bob',   offeredKind: 'TON', wantedKind: 'NFT', feeBps: 200 },
    { maker: 'carol', offeredKind: 'NFT', wantedKind: 'NFT', feeBps: 200 },
  ];

  for (const o of offers) {
    await prisma.offer.create({ data: o });
  }

  console.log('✅ Seed completed:', offers.length, 'offers created');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
