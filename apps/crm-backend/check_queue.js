require('dotenv').config();
const { Queue } = require('bullmq');

async function checkQueue() {
  const parsed = new URL(process.env.UPSTASH_REDIS_URL);
  const bullMQConnection = {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    username: parsed.username || 'default',
    password: decodeURIComponent(parsed.password),
    tls: { rejectUnauthorized: false },
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
  };

  const queue = new Queue('campaign-send', { connection: bullMQConnection });
  
  const waiting = await queue.getWaitingCount();
  const active = await queue.getActiveCount();
  const delayed = await queue.getDelayedCount();
  const failed = await queue.getFailedCount();
  const completed = await queue.getCompletedCount();
  
  console.log(`Queue Status:`);
  console.log(`- Waiting: ${waiting}`);
  console.log(`- Active: ${active}`);
  console.log(`- Delayed (retries): ${delayed}`);
  console.log(`- Failed: ${failed}`);
  console.log(`- Completed: ${completed}`);

  process.exit(0);
}

checkQueue().catch(console.error);
