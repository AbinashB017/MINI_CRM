const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fullAnalysis() {
  // Get last 4 campaigns
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    take: 4,
    select: { id: true, name: true, status: true, createdAt: true }
  });

  for (const c of campaigns) {
    console.log(`\n========== Campaign: ${c.name} (${c.id}) ==========`);
    console.log(`Status: ${c.status} | Created: ${c.createdAt}`);

    const statuses = await prisma.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId: c.id },
      _count: { status: true }
    });
    console.log('Status breakdown:', statuses);

    const failReasons = await prisma.campaignRecipient.groupBy({
      by: ['failReason'],
      where: { campaignId: c.id, status: 'failed' },
      _count: { failReason: true }
    });
    console.log('Fail reasons:', failReasons);
  }

  await prisma.$disconnect();
}

fullAnalysis().catch(console.error);
