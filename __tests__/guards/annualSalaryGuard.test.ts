import { prisma } from "../../lib/prisma"

const describeIfDbEnabled =
  process.env.RUN_DB_GUARD_TESTS === "1" ? describe : describe.skip

describeIfDbEnabled("Annual salary invariant", () => {
  it("has no jobs with monthly / invalid annual salaries", async () => {
    const bad = await prisma.job.count({
      where: {
        OR: [
          { minAnnual: { lt: BigInt(50000) } },
          { maxAnnual: { lt: BigInt(50000) } },
          { minAnnual: { gt: BigInt(5_000_000) } },
          { maxAnnual: { gt: BigInt(5_000_000) } },
        ],
      },
    })

    expect(bad).toBe(0)
  })
})
