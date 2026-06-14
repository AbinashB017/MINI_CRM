require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { Queue } = require('bullmq');
const bullMQConnection = require('./src/lib/redis').bullMQConnection;

async function checkEverything() {
  console.log("=== 1. CHECKING BULLMQ QUEUE ===");
  const queue = new Queue('campaign-send', { connection: bullMQConnection });
  
  const waiting = await queue.getWaitingCount();
  const active = await queue.getActiveCount();
  const delayed = await queue.getDelayedCount();
  const failed = await queue.getFailedCount();
  const completed = await queue.getCompletedCount();
  
  console.log(`- Waiting: ${waiting}`);
  console.log(`- Active: ${active}`);
  console.log(`- Delayed (retries): ${delayed}`);
  console.log(`- Failed: ${failed}`);
  console.log(`- Completed: ${completed}`);

  console.log("\n=== 2. CHECKING RECENT CAMPAIGNS IN DB ===");
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    take: 2,
    select: { id: true, name: true, status: true, createdAt: true }
  });

  for (const c of campaigns) {
    console.log(`\nCampaign: ${c.name} (${c.id}) | DB Status: ${c.status} | Created: ${c.createdAt}`);
    const statuses = await prisma.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId: c.id },
      _count: { status: true }
    });
    for (const s of statuses) {
      console.log(`  - ${s.status}: ${s._count.status}`);
    }
  }

  if (failed > 0) {
    console.log("\n=== 3. CHECKING BULLMQ FAILED JOBS ===");
    const failedJobs = await queue.getFailed(0, 5);
    for (const job of failedJobs) {
      console.log(`Job ${job.id} | Campaign: ${job.data?.campaignId} | Attempts: ${job.attemptsMade} | Reason: ${job.failedReason}`);
    }
  }

  process.exit(0);
}

checkEverything().catch(console.error);
