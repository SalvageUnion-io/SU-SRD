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
export type LongTask = {
    startTime: number;
    duration: number;
};
export type LayoutShift = {
    startTime: number;
    value: number;
    hadRecentInput: boolean;
};
export type Vitals = {
    lcp: number;
    tbt: number;
    cls: number;
};
export type Budget = Vitals;
export declare function totalBlockingTime(tasks: LongTask[], fcp: number): number;
export declare function cumulativeLayoutShift(shifts: LayoutShift[]): number;
export declare function median(values: number[]): number;
/** Each metric's median across runs, so one noisy load cannot fail a page. */
export declare function medianVitals(runs: Vitals[]): Vitals;
/** One line per metric over its budget; empty when the page is within all three. */
export declare function overBudget(page: string, measured: Vitals, budget: Budget): string[];
/** A Markdown table of every page's medians against its budgets, for the job summary. */
export declare function vitalsTable(rows: {
    page: string;
    measured: Vitals;
    budget: Budget;
}[]): string;
