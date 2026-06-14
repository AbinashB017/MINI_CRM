const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.campaignRecipient.groupBy({by: ['failReason'], _count: {failReason: true}}).then(r => {
  console.log(r);
  return prisma.$disconnect();
});
