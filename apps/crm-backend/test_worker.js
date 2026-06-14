const { Worker } = require('bullmq');
const axios = require('axios');
const bullMQConnection = require('./src/lib/redis').bullMQConnection;

async function testWorker() {
  console.log("Starting test worker to grab ONE job and see why it fails...");
  
  const worker = new Worker('campaign-send', async (job) => {
    console.log(`\n--- Grabbed Job ${job.id} ---`);
    const { recipientId, customerId, channel } = job.data;
    console.log(`Recipient: ${recipientId}, Channel: ${channel}`);
    
    // We will just do the axios call exactly as the real worker does
    const CHANNEL_STUB_URL = process.env.CHANNEL_STUB_URL || 'http://localhost:4001';
    console.log(`Making request to: ${CHANNEL_STUB_URL}/send`);
    
    try {
      const res = await axios.post(
        `${CHANNEL_STUB_URL}/send`,
        {
          recipientId,
          customerId,
          channel,
          to: 'test@example.com',
          message: 'test message',
          callbackUrl: 'http://localhost:3001/api/webhooks/receipt',
        },
        { timeout: 10000 }
      );
      console.log(`Success! Status: ${res.status}`);
      console.log('Response data:', res.data);
    } catch (err) {
      console.error(`Axios failed!`);
      if (err.response) {
        console.error(`Status: ${err.response.status}`);
        console.error(`Data:`, err.response.data);
      } else if (err.request) {
        console.error(`No response received. Error message: ${err.message}`);
        console.error(`Code: ${err.code}`);
      } else {
        console.error(`Error message: ${err.message}`);
      }
      throw err;
    }
  }, { 
    connection: bullMQConnection, 
    concurrency: 1 
  });

  worker.on('failed', (job, err) => {
    console.log(`Job ${job.id} failed with error: ${err.message}`);
    process.exit(1);
  });
  
  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully!`);
    process.exit(0);
  });
}

testWorker().catch(console.error);
