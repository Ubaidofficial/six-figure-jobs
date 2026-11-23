// Loads the browser error reports of the last days and groups them (lib/admin/errorReports.ts). The table holds
// hundreds of rows, not millions, so grouping in code keeps one definition of "the same error" for listing and resolving.
// Stacks are cut to 2,000 characters when read: a page never needs more, and a flood of reports stays cheap to load.
import { groupErrorReports, isNoiseError, errorGroupKey, type ErrorGroup, type ErrorReportRow } from '../../../../lib/admin/errorReports'
import { prisma } from '../../../../lib/prisma'

export const ERROR_WINDOW_DAYS = 30
const MAX_ROWS = 10_000

export async function loadErrorRows(days: number = ERROR_WINDOW_DAYS, onlyNew = false): Promise<ErrorReportRow[]> {
  const since = new Date(Date.now() - days * 86_400_000)
  return onlyNew
    ? prisma.$queryRaw<ErrorReportRow[]>`
        SELECT id, message, left(stack, 2000) AS stack, url, left("userAgent", 300) AS "userAgent", status, "createdAt"
        FROM "ErrorLog" WHERE "createdAt" >= ${since} AND status = 'new' ORDER BY "createdAt" DESC LIMIT ${MAX_ROWS}`
    : prisma.$queryRaw<ErrorReportRow[]>`
        SELECT id, message, left(stack, 2000) AS stack, url, left("userAgent", 300) AS "userAgent", status, "createdAt"
        FROM "ErrorLog" WHERE "createdAt" >= ${since} ORDER BY "createdAt" DESC LIMIT ${MAX_ROWS}`
}

export async function loadErrorGroups(days: number = ERROR_WINDOW_DAYS): Promise<ErrorGroup[]> {
  return groupErrorReports(await loadErrorRows(days))
}

/** Issues with at least one unresolved report that are not known noise: the count shown in the navigation. */
export async function countNewErrorGroups(): Promise<number> {
  const keys = new Set<string>()
  for (const r of await loadErrorRows(ERROR_WINDOW_DAYS, true)) {
    if (!isNoiseError(r.message, r.stack)) keys.add(errorGroupKey(r.message))
  }
  return keys.size
}
