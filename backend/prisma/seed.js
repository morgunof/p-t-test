import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function plusHours(h) {
  return new Date(Date.now() + h * 60 * 60 * 1000);
}

async function main() {
  const offers = [
    {
      maker: 'seed-maker-1',
      offeredKind: 'NFT',
      wantedKind: 'TON',
      feeBps: 200,
      status: 'Active',
      deadline: plusHours(24),
      makerDeposited: false,
      takerDeposited: false,
    },
    {
      maker: 'seed-maker-2',
      offeredKind: 'TON',
      wantedKind: 'NFT',
      feeBps: 200,
      status: 'Active',
      deadline: plusHours(24),
      makerDeposited: false,
      takerDeposited: false,
    },
    {
      maker: 'seed-maker-3',
      offeredKind: 'NFT',
      wantedKind: 'NFT',
      feeBps: 200,
      status: 'Active',
      deadline: plusHours(48),
      makerDeposited: false,
      takerDeposited: false,
    },
  ];

  for (const o of offers) {
    await prisma.offer.create({ data: o });
  }
  console.log(`✅ Seed completed: ${offers.length} offers created`);
}

main()
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
