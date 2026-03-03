import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function expireJobsWithLongTextNoRealSalary() {
  // Jobs with >5KB text and inflated salaries = likely no real salary data
  const jobs = await prisma.job.findMany({
    where: {
      isExpired: false,
      maxAnnual: { gte: 1000000 },
      salaryRaw: { not: null },
    },
    select: { id: true, salaryRaw: true }
  });

  let expired = 0;
  for (const job of jobs) {
    if (job.salaryRaw && job.salaryRaw.length > 5000) {
      await prisma.job.update({
        where: { id: job.id },
        data: { isExpired: true }
      });
      expired++;
    }
  }

  console.log(`✅ Expired ${expired} jobs with long text but no real salary`);
  await prisma.$disconnect();
}

expireJobsWithLongTextNoRealSalary().catch(console.error);
