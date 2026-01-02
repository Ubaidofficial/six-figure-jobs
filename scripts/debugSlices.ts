import { format as __format } from 'node:util'
import { PrismaClient } from "@prisma/client";

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient();

async function main() {
  const slices = await prisma.jobSlice.findMany();
  __slog("JobSlices:", slices);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
