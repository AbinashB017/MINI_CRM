const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const latestCampaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3
  });
  
  for (const camp of latestCampaigns) {
    const reasons = await prisma.campaignRecipient.groupBy({
      by: ['failReason'],
      where: { campaignId: camp.id },
      _count: { failReason: true }
    });
    console.log(`Campaign ${camp.id} Fail Reasons:`, reasons);
  }
  await prisma.$disconnect();
}
run().catch(console.error);
