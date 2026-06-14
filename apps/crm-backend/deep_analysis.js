const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deepAnalysis() {
  // Get last 3 campaigns
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { id: true, name: true, status: true, createdAt: true, sentAt: true }
  });

  for (const c of campaigns) {
    console.log(`\n========== ${c.name} (${c.id}) ==========`);
    console.log(`DB Status: ${c.status} | Created: ${c.createdAt}`);

    const statuses = await prisma.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId: c.id },
      _count: { status: true }
    });
    
    const total = statuses.reduce((sum, s) => sum + s._count.status, 0);
    console.log(`Total recipients in DB: ${total}`);
    console.log('Status breakdown:');
    for (const s of statuses) {
      console.log(`  ${s.status}: ${s._count.status}`);
    }

    // Check fail reasons
    const fails = await prisma.campaignRecipient.groupBy({
      by: ['failReason'],
      where: { campaignId: c.id, status: 'failed' },
      _count: { failReason: true }
    });
    if (fails.length > 0) {
      console.log('Fail reasons:');
      for (const f of fails) {
        console.log(`  "${f.failReason}": ${f._count.failReason}`);
      }
    }

    // Check a sample pending recipient - look at message field
    const sample = await prisma.campaignRecipient.findFirst({
      where: { campaignId: c.id, status: 'pending' },
      select: { id: true, message: true, createdAt: true }
    });
    if (sample) {
      console.log(`Sample PENDING recipient message: "${sample.message?.substring(0, 80)}"`);
    }

    // Check a sample sent recipient
    const sentSample = await prisma.campaignRecipient.findFirst({
      where: { campaignId: c.id, status: 'sent' },
      select: { id: true, message: true, sentAt: true }
    });
    if (sentSample) {
      console.log(`Sample SENT recipient: sentAt=${sentSample.sentAt} msg="${sentSample.message?.substring(0, 80)}"`);
    }
  }

  await prisma.$disconnect();
}

deepAnalysis().catch(console.error);
