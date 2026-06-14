const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { Queue } = require('bullmq');
const bullMQConnection = require('./src/lib/redis').bullMQConnection;

async function testUpdate() {
  const queue = new Queue('campaign-send', { connection: bullMQConnection });
  const failedJobs = await queue.getFailed(0, 1);
  const job = failedJobs[0];

  console.log(`Trying to update recipient ${job.data.recipientId} ...`);

  try {
    const res = await prisma.campaignRecipient.update({
      where: { id: job.data.recipientId },
      data: { status: 'failed', failReason: job.failedReason.substring(0, 255) }
    });
    console.log("Success:", res.id, res.status);
  } catch (err) {
    console.error("Update failed:", err);
  }
  
  process.exit(0);
}

testUpdate().catch(console.error);
