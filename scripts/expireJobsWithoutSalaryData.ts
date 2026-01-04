import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function expireJobsWithoutSalaryData() {
  // Find jobs with suspiciously high salaries but no salary keywords in raw text
  const result = await prisma.job.updateMany({
    where: {
      currency: 'AUD',
      maxAnnual: { gte: 600000 },
      isExpired: false,
      salaryRaw: {
        not: {
          contains: '$'
        }
      }
    },
    data: {
      isExpired: true
    }
  });

  console.log(`✅ Expired ${result.count} jobs without salary data`);
  await prisma.$disconnect();
}

expireJobsWithoutSalaryData().catch(console.error);
