require('dotenv').config();
const { Queue } = require('bullmq');

async function inspectFailed() {
  const parsed = new URL(process.env.UPSTASH_REDIS_URL);
  const bullMQConnection = {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    username: parsed.username || 'default',
    password: decodeURIComponent(parsed.password),
    tls: { rejectUnauthorized: false },
  };

  const queue = new Queue('campaign-send', { connection: bullMQConnection });
  
  const failedJobs = await queue.getFailed(0, 10);
  console.log(`Found ${failedJobs.length} failed jobs to inspect`);
  
  for (const job of failedJobs) {
    console.log(`\n--- Job ${job.id} ---`);
    console.log(`CampaignId: ${job.data.campaignId}`);
    console.log(`Attempts Made: ${job.attemptsMade}`);
    console.log(`Max Attempts (opts): ${job.opts.attempts}`);
    console.log(`Failed Reason: ${job.failedReason}`);
  }

  process.exit(0);
}

inspectFailed().catch(console.error);
