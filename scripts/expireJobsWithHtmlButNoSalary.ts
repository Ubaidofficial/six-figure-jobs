import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function expireJobsWithHtmlButNoSalary() {
  // Jobs with HTML content but no salary markers
  const result = await prisma.job.updateMany({
    where: {
      isExpired: false,
      maxAnnual: { gte: 600000 },
      salaryRaw: {
        contains: '<div'  // Has HTML
      },
      NOT: {
        salaryRaw: {
          contains: '$'  // But no salary
        }
      }
    },
    data: {
      isExpired: true
    }
  });

  console.log(`✅ Expired ${result.count} jobs with HTML but no salary data`);
  await prisma.$disconnect();
}

expireJobsWithHtmlButNoSalary().catch(console.error);
