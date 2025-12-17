import { prisma } from "../lib/prisma"
import { annotateJobWithAI } from "../lib/ai/jobAnnotator"

const TAKE = Number(process.env.AI_TAKE ?? 300)
const CONCURRENCY = Number(process.env.AI_CONCURRENCY ?? 3)
const MAX_CALLS = Number(process.env.AI_MAX_CALLS ?? TAKE)
const MAX_DESC_CHARS = Number(process.env.AI_MAX_DESC_CHARS ?? 5000)
const TRIES = Number(process.env.AI_TRIES ?? 2)

async function withRetry<T>(fn: () => Promise<T>, tries = 3) {
  let lastErr: any = null
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      const ms = 750 * Math.pow(2, i)
      await new Promise((r) => setTimeout(r, ms))
    }
  }
  throw lastErr
}

async function runWithPool<T>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<void>
) {
  let i = 0
  const workers = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++
      await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
}

async function run() {
  const jobs = await prisma.job.findMany({
    select: {
      id: true,
      title: true,
      descriptionHtml: true,
      salaryRaw: true,
    },
    where: {
      aiSnippet: null,
      OR: [
        { isHighSalary: true },
        { isHighSalaryLocal: true },
        { isHundredKLocal: true },
      ],
    },
    take: TAKE,
  })

  console.log("Re-analyzing " + jobs.length + " jobs (concurrency=5)")

  let done = 0
  let ok = 0
  let fail = 0

  await runWithPool(limited, CONCURRENCY, async (job, _idx) => {
    const n = ++done
    console.log("[" + n + "/" + jobs.length + "] start " + job.id)

    try {
      const enriched = await withRetry(
        () =>
          annotateJobWithAI({
            title: job.title ?? "",
            description: String(job.descriptionHtml ?? job.salaryRaw ?? "").slice(0, MAX_DESC_CHARS),
          }),
        3
      )

      await prisma.job.update({
        where: { id: job.id },
        data: { aiSnippet: enriched?.summary ?? null },
      })

      ok++
      console.log("[" + n + "/" + jobs.length + "] done " + job.id)
    } catch (e: any) {
      fail++
      console.error(
        "[" + n + "/" + jobs.length + "] fail " + job.id,
        e?.message ?? e
      )
    }
  })

  console.log("Finished. ok=" + ok + " fail=" + fail)
}

run()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
