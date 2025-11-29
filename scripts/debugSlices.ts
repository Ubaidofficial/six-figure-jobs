import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const slices = await prisma.jobSlice.findMany();
  console.log("JobSlices:", slices);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
