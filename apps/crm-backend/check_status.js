const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const latestCampaign = await prisma.campaign.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  const statuses = await prisma.campaignRecipient.groupBy({
    by: ['status'],
    where: { campaignId: latestCampaign.id },
    _count: { status: true }
  });
  console.log(statuses);
  await prisma.$disconnect();
}
run().catch(console.error);
