const { PrismaClient } = require('@prisma/client');
const { Queue } = require('bullmq');
const { Redis } = require('ioredis');

const prisma = new PrismaClient();
const connection = new Redis(process.env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: null,
  tls: { rejectUnauthorized: false }
});
const queue = new Queue('campaign-send', { connection });

async function analyze() {
  console.log("--- Latest Campaign Stats ---");
  const latestCampaign = await prisma.campaign.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  console.log("Campaign ID:", latestCampaign.id, "| Status:", latestCampaign.status);

  const statuses = await prisma.campaignRecipient.groupBy({
    by: ['status'],
    where: { campaignId: latestCampaign.id },
    _count: { status: true }
  });
  console.log("Recipient Statuses:", statuses);

  console.log("\n--- BullMQ Queue Stats ---");
  const counts = await queue.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed');
  console.log("Job Counts:", counts);
  
  if (counts.failed > 0) {
    const failedJobs = await queue.getFailed(0, 1);
    if (failedJobs.length > 0) {
      console.log("Sample Failed Job Reason:", failedJobs[0].failedReason);
    }
  }

  await prisma.$disconnect();
  await connection.quit();
}

analyze().catch(console.error);
