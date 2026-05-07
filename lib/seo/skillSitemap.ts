import { prisma } from '../prisma'
import { buildWhere } from '../jobs/queryJobs'
import { getSiteUrl } from './site'
import { SKILL_TARGETS } from './pseoTargets'

const SITE_URL = getSiteUrl()
const MIN_SKILL_INDEXABLE_JOBS = 3

export async function getSkillSitemapUrls() {
  const rows = await Promise.all(
    SKILL_TARGETS.map(async (skill) => {
      const where = buildWhere({
        skillSlugs: [skill.slug],
        isHundredKLocal: true,
        page: 1,
        pageSize: 1,
      })

      const agg = await prisma.job.aggregate({
        where,
        _count: { _all: true },
        _max: { updatedAt: true },
      })

      const total = Number(agg._count?._all ?? 0)
      if (total < MIN_SKILL_INDEXABLE_JOBS) return null

      return {
        loc: `${SITE_URL}/jobs/skills/${skill.slug}`,
        lastmod: (agg._max.updatedAt ?? new Date()).toISOString(),
      }
    }),
  )

  return rows.filter(Boolean) as Array<{ loc: string; lastmod: string }>
}
