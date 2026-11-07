// lib/listing/pageNumbers.ts
//
// Which pages a paginated list links to from the current page. A list of ~180 pages with only "Previous" and "Next"
// is 180 clicks deep for a crawler; linking the first and last page, a window around the current one, and jumps of 5,
// 25 and 100 either way puts every page within a handful of clicks of page 1.

const JUMPS = [5, 25, 100]
const WINDOW = 2

export function pageLinkNumbers(page: number, totalPages: number): number[] {
  const total = Math.max(1, Math.floor(totalPages))
  const current = Math.min(Math.max(1, Math.floor(page)), total)
  const wanted = new Set<number>([1, total])
  for (let n = current - WINDOW; n <= current + WINDOW; n++) wanted.add(n)
  for (const j of JUMPS) {
    wanted.add(current - j)
    wanted.add(current + j)
  }
  return [...wanted].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)
}

/** The fewest clicks from page 1 to `target` when each page links as above (breadth-first; used to prove the depth bound in tests). */
export function clicksFromFirstPage(target: number, totalPages: number): number {
  const total = Math.max(1, Math.floor(totalPages))
  if (target < 1 || target > total) return Infinity
  const distance = new Map<number, number>([[1, 0]])
  const queue = [1]
  for (let i = 0; i < queue.length; i++) {
    const from = queue[i]
    for (const n of pageLinkNumbers(from, total)) {
      if (!distance.has(n)) {
        distance.set(n, (distance.get(from) ?? 0) + 1)
        queue.push(n)
      }
    }
  }
  return distance.get(target) ?? Infinity
}
