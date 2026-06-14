require('dotenv').config();
const { Queue } = require('bullmq');

async function inspectDelayed() {
  const parsed = new URL(process.env.UPSTASH_REDIS_URL);
  const bullMQConnection = {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    username: parsed.username || 'default',
    password: decodeURIComponent(parsed.password),
    tls: { rejectUnauthorized: false },
  };

  const queue = new Queue('campaign-send', { connection: bullMQConnection });
  
  const delayedJobs = await queue.getDelayed(0, 5);
  console.log(`Found ${delayedJobs.length} delayed jobs`);
  
  for (const job of delayedJobs) {
    console.log(`\n--- Delayed Job ${job.id} ---`);
    console.log(`Attempts Made: ${job.attemptsMade}`);
    console.log(`Failed Reason: ${job.failedReason}`);
    console.log(`Stacktrace: ${job.stacktrace ? job.stacktrace[0] : 'None'}`);
  }

  process.exit(0);
}

inspectDelayed().catch(console.error);
