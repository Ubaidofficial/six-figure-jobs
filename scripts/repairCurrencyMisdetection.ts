// scripts/repairCurrencyMisdetection.ts
import { PrismaClient } from '@prisma/client';
import { parseSalaryFromText } from '../lib/normalizers/salary';

const prisma = new PrismaClient();

async function repairCurrencyMisdetection() {
  // Find suspicious AUD jobs (likely INR)
  const suspicious = await prisma.job.findMany({
    where: {
      currency: 'AUD',
      salaryRaw: { contains: '₹' }, // Rupee symbol = INR
      isExpired: false
    },
    select: { id: true, salaryRaw: true }
  });

  console.log(`Found ${suspicious.length} AUD jobs with ₹ symbol`);

  for (const job of suspicious) {
    // Re-parse with fixed logic
    const corrected = parseSalaryFromText(job.salaryRaw);
    
    if (corrected.currency === 'INR') {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          currency: 'INR',
          salaryCurrency: 'INR',
          minAnnual: corrected.min,
          maxAnnual: corrected.max,
          salaryValidated: corrected.min >= 2500000 // INR threshold
        }
      });
      console.log(`✅ Fixed: ${job.id} AUD→INR`);
    }
  }
  
  await prisma.$disconnect();
}

repairCurrencyMisdetection().catch(console.error);
