require('dotenv').config();
const { Queue } = require('bullmq');

async function emptyQueue() {
  const parsed = new URL(process.env.UPSTASH_REDIS_URL);
  const bullMQConnection = {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    username: parsed.username || 'default',
    password: decodeURIComponent(parsed.password),
    tls: { rejectUnauthorized: false },
  };

  const queue = new Queue('campaign-send', { connection: bullMQConnection });
  
  console.log("Emptying the queue to save Redis usage...");
  await queue.obliterate({ force: true });
  console.log("Queue obliterated successfully.");

  process.exit(0);
}

emptyQueue().catch(console.error);
