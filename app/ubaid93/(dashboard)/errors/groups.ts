// Loads the browser error reports of the last days and groups them (lib/admin/errorReports.ts). The table holds
// hundreds of rows, not millions, so grouping in code keeps one definition of "the same error" for listing and resolving.
// Stacks are cut to 2,000 characters when read: a page never needs more, and a flood of reports stays cheap to load.
import { memoAsync } from '../../../../lib/cache/memo'
import { groupErrorReports, type ErrorGroup, type ErrorReportRow } from '../../../../lib/admin/errorReports'
import { prisma } from '../../../../lib/prisma'

export const ERROR_WINDOW_DAYS = 30
const MAX_ROWS = 10_000

/** `stackChars`: how much of each stack to read (the noise rule needs only its start; the page shows up to 2,000). */
export async function loadErrorRows(days: number = ERROR_WINDOW_DAYS, stackChars = 2000): Promise<ErrorReportRow[]> {
  const since = new Date(Date.now() - days * 86_400_000)
  return prisma.$queryRaw<ErrorReportRow[]>`
    SELECT id, message, left(stack, ${stackChars}::int) AS stack, url, left("userAgent", 300) AS "userAgent", status, "createdAt"
    FROM "ErrorLog" WHERE "createdAt" >= ${since} ORDER BY "createdAt" DESC LIMIT ${MAX_ROWS}`
}

export async function loadErrorGroups(days: string[] = []): Promise<ErrorGroup[]> {
  return groupErrorReports(await loadErrorRows(), days)
}

/** Issues with unresolved reports that are not noise: the count beside Errors on every page, kept for a minute. */
export async function countNewErrorGroups(): Promise<number> {
  return memoAsync('admin:error-badge', 60_000, async () => {
    const groups = groupErrorReports(await loadErrorRows(ERROR_WINDOW_DAYS, 300))
    return groups.filter((g) => g.newCount > 0 && !g.noise).length
  })
}
