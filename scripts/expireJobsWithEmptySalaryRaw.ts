import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function expireJobsWithEmptySalaryRaw() {
  // Expire jobs with no salary data at all
  const result = await prisma.job.updateMany({
    where: {
      isExpired: false,
      OR: [
        { salaryRaw: null },
        { salaryRaw: '' }
      ],
      maxAnnual: { gte: 600000 } // High values without salary text = invalid
    },
    data: {
      isExpired: true
    }
  });

  console.log(`✅ Expired ${result.count} jobs with empty salaryRaw`);
  await prisma.$disconnect();
}

expireJobsWithEmptySalaryRaw().catch(console.error);
