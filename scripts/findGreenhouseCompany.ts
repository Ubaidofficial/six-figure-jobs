import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

async function find() {
  const company = await prisma.company.findFirst({
    where: {
      atsProvider: 'greenhouse',
      atsUrl: { not: null }
    }
  })
  
  if (company) {
    __slog('Company:', company.name)
    __slog('ATS URL:', company.atsUrl)
  }
}

find()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
