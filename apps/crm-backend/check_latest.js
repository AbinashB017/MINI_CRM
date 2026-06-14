const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const latestCampaign = await prisma.campaign.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  const reasons = await prisma.campaignRecipient.groupBy({
    by: ['failReason'],
    where: { campaignId: latestCampaign.id },
    _count: { failReason: true }
  });
  console.log(reasons);
  await prisma.$disconnect();
}
run().catch(console.error);
