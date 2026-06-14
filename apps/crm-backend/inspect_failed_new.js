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
  
  const failedJobs = await queue.getFailed(0, 50);
  
  const newCampaignId = 'cmqe9s2xk0003bgh3sniszqxz'; // From check_everything output
  let count = 0;
  for (const job of failedJobs) {
    if (job.data?.campaignId === newCampaignId) {
      count++;
      console.log(`\n--- NEW CAMPAIGN Job ${job.id} ---`);
      console.log(`Attempts Made: ${job.attemptsMade}`);
      console.log(`Failed Reason: ${job.failedReason}`);
      if (count >= 5) break;
    }
  }

  if (count === 0) {
    console.log("No failed jobs found for the new campaign yet.");
  }

  process.exit(0);
}

inspectFailed().catch(console.error);
