import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function expireAllOutliersWithLongText() {
  const jobs = await prisma.job.findMany({
    where: {
      isExpired: false,
      maxAnnual: { gte: 600000 },
    },
    select: { id: true, salaryRaw: true, currency: true, maxAnnual: true }
  });

  let expired = 0;
  for (const job of jobs) {
    // Expire if: no salaryRaw OR long text (>3000 chars)
    if (!job.salaryRaw || job.salaryRaw.length > 3000) {
      await prisma.job.update({
        where: { id: job.id },
        data: { isExpired: true }
      });
      console.log(`✅ Expired: ${job.currency} ${job.maxAnnual}`);
      expired++;
    }
  }

  console.log(`\n✅ Total expired: ${expired} outliers`);
  await prisma.$disconnect();
}

expireAllOutliersWithLongText().catch(console.error);
