require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLocalTest() {
  const latestCampaign = await prisma.campaign.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, status: true, createdAt: true }
  });

  console.log(`Latest Campaign: ${latestCampaign.name} (${latestCampaign.id})`);
  console.log(`Status: ${latestCampaign.status}`);

  const statuses = await prisma.campaignRecipient.groupBy({
    by: ['status'],
    where: { campaignId: latestCampaign.id },
    _count: { status: true }
  });

  console.log('\nActual DB Status Breakdown:');
  for (const s of statuses) {
    console.log(`  - ${s.status}: ${s._count.status}`);
  }

  process.exit(0);
}

checkLocalTest().catch(console.error);
