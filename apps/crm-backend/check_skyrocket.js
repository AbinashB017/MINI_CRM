require('dotenv').config();
const { Queue } = require('bullmq');

async function checkSkyrocket() {
  const parsed = new URL(process.env.UPSTASH_REDIS_URL);
  const bullMQConnection = {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    username: parsed.username || 'default',
    password: decodeURIComponent(parsed.password),
    tls: { rejectUnauthorized: false },
  };

  const queue = new Queue('campaign-send', { connection: bullMQConnection });
  
  const delayed = await queue.getDelayedCount();
  const failed = await queue.getFailedCount();
  const active = await queue.getActiveCount();
  const waiting = await queue.getWaitingCount();

  console.log(`Queue Stats: Waiting=${waiting}, Active=${active}, Delayed=${delayed}, Failed=${failed}`);

  const delayedJobs = await queue.getDelayed(0, 5);
  console.log(`\nSample Delayed Jobs (retrying):`);
  for (const job of delayedJobs) {
    console.log(`Job ${job.id} | Campaign: ${job.data?.campaignId} | Attempts: ${job.attemptsMade} | Reason: ${job.failedReason}`);
    console.log(`Stacktrace: ${job.stacktrace ? job.stacktrace[0].substring(0, 200) : 'None'}`);
  }

  process.exit(0);
}

checkSkyrocket().catch(console.error);
