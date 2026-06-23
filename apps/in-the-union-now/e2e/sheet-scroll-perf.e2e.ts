import { test, expect } from '@playwright/test'
import { buildMech, openSheetFor, waitForReady } from './_helpers'

/**
 * Sheet-scroll performance probe (REQ-NF-03).
 *
 * Acceptance for REQ-NF-03 is a non-functional perf bar: the live sheet must
 * keep scrolling at 60 FPS on an iPhone-class device. The methodology, the
 * pass bar, and how to read this probe are documented in
 * docs/architecture/sheet-scroll-performance.md — read that first.
 *
 * Why this assertion shape: 60 FPS means the browser has a ~16.7 ms budget per
 * frame. Smooth scrolling on a compositor-driven page is broken by *main-thread
 * long tasks* (≥ 50 ms blocks, the Long Tasks API definition) landing during
 * the scroll — they stall the rAF/commit pipeline and drop frames. The ITUN
 * sheet path is deliberately free of per-frame scroll JS (the condense bar is
 * an IntersectionObserver single-threshold toggle, not an onScroll handler —
 * see LiveSheet.tsx `useCondensed`), so a healthy run records ZERO long tasks
 * across a full programmatic scroll of the sheet. We assert exactly that.
 *
 * This is a regression guard, not the primary 60-FPS sign-off: the canonical
 * frame-rate baseline is captured manually under CPU + device throttling (see
 * the doc). A long task appearing here means new per-frame scroll work crept
 * onto the sheet path and the manual baseline should be re-measured.
 *
 * Chromium-only: the Long Tasks API (PerformanceObserver 'longtask') is a
 * Chromium feature, matching the CI project pin. The test self-skips on engines
 * that lack it rather than failing.
 */
test('mech sheet scroll generates no main-thread long tasks (REQ-NF-03)', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Long Tasks API is Chromium-only')

  // Arrange: a real mech sheet with body slabs to scroll past the hero.
  await buildMech(page, 'Perf Probe Mech')
  await openSheetFor(page, 'Perf Probe Mech')
  await waitForReady(page)

  // Start observing long tasks BEFORE scrolling so we capture the whole gesture.
  const longTaskSupported = await page.evaluate(() => {
    if (typeof PerformanceObserver === 'undefined') return false
    const supported = PerformanceObserver.supportedEntryTypes
    if (!supported || !supported.includes('longtask')) return false
    const w = window as unknown as { __longTasks: number[] }
    w.__longTasks = []
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.__longTasks.push(entry.duration)
    })
    observer.observe({ entryTypes: ['longtask'] })
    return true
  })

  test.skip(!longTaskSupported, 'Long Tasks API unavailable in this browser')

  // Act: scroll the document top→bottom in realistic steps, yielding a frame
  // between each so the scroll/condense path actually runs per step.
  await page.evaluate(async () => {
    const raf = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    const max = document.documentElement.scrollHeight - window.innerHeight
    const steps = 24
    for (let i = 0; i <= steps; i++) {
      window.scrollTo(0, Math.round((max * i) / steps))
      await raf()
      await raf()
    }
    // Scroll back up to exercise the condense → un-condense transition too.
    for (let i = steps; i >= 0; i--) {
      window.scrollTo(0, Math.round((max * i) / steps))
      await raf()
      await raf()
    }
  })

  // Assert: zero long tasks during the scroll gesture. The sheet path does no
  // per-frame main-thread work, so any long task is a real regression.
  const longTasks = await page.evaluate(
    () => (window as unknown as { __longTasks: number[] }).__longTasks
  )
  expect(
    longTasks,
    `expected no main-thread long tasks during sheet scroll, saw ${longTasks.length}: [${longTasks
      .map((d) => `${Math.round(d)}ms`)
      .join(', ')}]`
  ).toHaveLength(0)
})
