/**
 * The lab Core Web Vitals site's performance budget (`apps/web/e2e/perf-budget.e2e.ts`)
 * holds each page to, computed from the raw entries a page's own
 * PerformanceObservers buffered, the way Lighthouse computes them:
 *
 * - LCP: the last `largest-contentful-paint` entry's start time.
 * - TBT: every long task's time past 50 ms, counted only after FCP (a task
 *   straddling FCP counts its part after it).
 * - CLS: the largest session window of layout shifts without recent input
 *   (shifts under 1 s apart, a window at most 5 s long).
 *
 * The browser half lives in the spec; this half is pure, so it is tested.
 */

export type LongTask = { startTime: number; duration: number }
export type LayoutShift = { startTime: number; value: number; hadRecentInput: boolean }

export type Vitals = { lcp: number; tbt: number; cls: number }
export type Budget = Vitals

const BLOCKING_THRESHOLD_MS = 50
const SESSION_GAP_MS = 1_000
const SESSION_MAX_MS = 5_000

export function totalBlockingTime(tasks: LongTask[], fcp: number): number {
  let total = 0
  for (const { startTime, duration } of tasks) {
    const end = startTime + duration
    if (end <= fcp) continue
    // Lighthouse clips a task straddling FCP to the part after it.
    const counted = startTime < fcp ? end - fcp : duration
    total += Math.max(0, counted - BLOCKING_THRESHOLD_MS)
  }
  return total
}

export function cumulativeLayoutShift(shifts: LayoutShift[]): number {
  let worst = 0
  let current = 0
  let windowStart = Number.NEGATIVE_INFINITY
  let previous = Number.NEGATIVE_INFINITY
  for (const shift of [...shifts].sort((a, b) => a.startTime - b.startTime)) {
    if (shift.hadRecentInput) continue
    const startsNewWindow =
      shift.startTime - previous > SESSION_GAP_MS || shift.startTime - windowStart > SESSION_MAX_MS
    if (startsNewWindow) {
      current = 0
      windowStart = shift.startTime
    }
    current += shift.value
    previous = shift.startTime
    worst = Math.max(worst, current)
  }
  return worst
}

export function median(values: number[]): number {
  if (values.length === 0) throw new Error('median of no values')
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
}

/** Each metric's median across runs, so one noisy load cannot fail a page. */
export function medianVitals(runs: Vitals[]): Vitals {
  return {
    lcp: median(runs.map((run) => run.lcp)),
    tbt: median(runs.map((run) => run.tbt)),
    cls: median(runs.map((run) => run.cls)),
  }
}

/** One line per metric over its budget; empty when the page is within all three. */
export function overBudget(page: string, measured: Vitals, budget: Budget): string[] {
  const lines: string[] = []
  if (measured.lcp > budget.lcp)
    lines.push(`${page}: LCP ${Math.round(measured.lcp)} ms is over its ${budget.lcp} ms budget`)
  if (measured.tbt > budget.tbt)
    lines.push(`${page}: TBT ${Math.round(measured.tbt)} ms is over its ${budget.tbt} ms budget`)
  if (measured.cls > budget.cls)
    lines.push(`${page}: CLS ${measured.cls.toFixed(3)} is over its ${budget.cls} budget`)
  return lines
}

/** A Markdown table of every page's medians against its budgets, for the job summary. */
export function vitalsTable(rows: { page: string; measured: Vitals; budget: Budget }[]): string {
  const cell = (value: number, limit: number, text: string) =>
    `${value > limit ? '❌ ' : ''}${text}`
  return [
    '| Page | LCP (budget) | TBT (budget) | CLS (budget) |',
    '| --- | --- | --- | --- |',
    ...rows.map(
      ({ page, measured: m, budget: b }) =>
        `| ${page} | ${cell(m.lcp, b.lcp, `${Math.round(m.lcp)} ms (${b.lcp})`)} | ${cell(m.tbt, b.tbt, `${Math.round(m.tbt)} ms (${b.tbt})`)} | ${cell(m.cls, b.cls, `${m.cls.toFixed(3)} (${b.cls})`)} |`
    ),
  ].join('\n')
}
