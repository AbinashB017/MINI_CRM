const { Worker, Queue } = require('bullmq');
const bullMQConnection = require('./src/lib/redis').bullMQConnection;

async function test() {
  const queue = new Queue('test-q', { connection: bullMQConnection });
  await queue.add('test', { id: 1 }, { attempts: 2 });

  const worker = new Worker('test-q', async (job) => {
    throw new Error("fail");
  }, { connection: bullMQConnection });

  worker.on('failed', (job, err) => {
    console.log(`Failed! attemptsMade: ${job.attemptsMade}, opts.attempts: ${job.opts.attempts}`);
  });

  setTimeout(() => process.exit(0), 3000);
}

test().catch(console.error);
