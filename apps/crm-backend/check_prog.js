require('dotenv').config();
const { Queue } = require('bullmq');

async function checkProg() {
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
  const completed = await queue.getCompletedCount();

  console.log(`Queue Stats: Waiting=${waiting}, Active=${active}, Delayed=${delayed}, Failed=${failed}, Completed=${completed}`);

  process.exit(0);
}

checkProg().catch(console.error);
