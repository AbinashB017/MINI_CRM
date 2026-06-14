const { PrismaClient } = require('@prisma/client');
const { Queue } = require('bullmq');
const { bullMQConnection } = require('./src/lib/redis.ts');

const prisma = new PrismaClient();
const queue = new Queue('campaign-send', { connection: bullMQConnection });

async function testPipeline() {
  console.log("Creating test campaign...");
  const campaign = await prisma.campaign.create({
    data: {
      name: 'Local Test Pipeline',
      status: 'sending',
      channel: 'email',
      messageTemplate: 'Hi {{firstName}}, testing local pipeline!',
    }
  });

  const customers = await prisma.customer.findMany({ take: 5 });
  
  const recipientsData = customers.map(c => ({
    campaignId: campaign.id,
    customerId: c.id,
    status: 'pending'
  }));
  
  await prisma.campaignRecipient.createMany({ data: recipientsData });
  const recipients = await prisma.campaignRecipient.findMany({ where: { campaignId: campaign.id } });

  console.log(`Adding ${recipients.length} jobs to queue...`);
  
  const jobs = recipients.map(r => ({
    name: 'send-message',
    data: {
      recipientId: r.id,
      campaignId: r.campaignId,
      customerId: r.customerId,
      channel: 'email'
    }
  }));

  await queue.addBulk(jobs);
  console.log("Jobs added! Waiting 15 seconds to observe delivery...");

  await new Promise(r => setTimeout(r, 15000));

  const statuses = await prisma.campaignRecipient.groupBy({
    by: ['status'],
    where: { campaignId: campaign.id },
    _count: { status: true }
  });

  console.log("FINAL STATUSES:");
  console.log(statuses);

  await prisma.$disconnect();
  process.exit(0);
}

testPipeline().catch(console.error);
