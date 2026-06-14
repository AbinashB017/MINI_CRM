const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFailures() {
  const latestCampaign = await prisma.campaign.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  if (!latestCampaign) {
    console.log("No campaigns found.");
    return;
  }

  console.log(`Checking failures for campaign: ${latestCampaign.name} (${latestCampaign.id})`);

  const fails = await prisma.campaignRecipient.groupBy({
    by: ['failReason'],
    where: { 
      campaignId: latestCampaign.id,
      status: 'failed'
    },
    _count: { failReason: true }
  });

  console.log(fails);

  await prisma.$disconnect();
}

checkFailures().catch(console.error);
