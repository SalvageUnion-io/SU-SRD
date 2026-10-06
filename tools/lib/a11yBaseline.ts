/**
 * The accepted-violation baseline for `tools/a11y-scan.ts`, and the judgement
 * of a run against it. Kept apart from the scanner so it can be tested without
 * a browser.
 */

/**
 * The accepted-violation baseline: page path -> the axe rule ids tolerated there.
 *
 * A rule id in this file is DEBT, deliberately accepted with a reason recorded
 * beside it. A rule id NOT in this file is a regression, and the run exits
 * non-zero on it.
 *
 * The point of the shape is that it only ever gets easier to satisfy: adding a
 * page or a rule requires editing this file, which is a reviewable act, while
 * fixing something and deleting its entry needs no ceremony at all —
 * `--update-baseline` deletes it. That flag only ever removes.
 */
export type Baseline = {
  /** Free-text, per key, explaining why each id is tolerated. Not read by code. */
  $rationale?: Record<string, string>
  pages: Record<string, string[]>
}

/** The slice of one page scan, on one device, that the baseline judges. */
export type ScanOutcome = {
  page: string
  device: string
  /** The violation count, or -1 when the scan itself failed. */
  violations: number
  details: { id: string }[]
}

/**
 * Compare a run against the baseline.
 *
 * Reports two things, and the second is the one that keeps the file honest:
 * NEW ids (a regression) and STALE entries (an id that no longer fires, or a
 * page that is no longer scanned). A baseline nobody prunes drifts into a
 * blanket exemption, so a stale entry is a failure too.
 *
 * A page scanned on several devices is judged on the UNION of what fired: an
 * accepted id is live if any device still sees it, so one baseline serves the
 * desktop and the phone run without either reporting the other's debt stale.
 *
 * A page with a crashed scan on ANY device is left out of the stale check and
 * kept as it is in `pruned`: the union is incomplete, and the device that
 * crashed may be the one that sees the accepted id. The crash is already a
 * regression, so the run fails either way; what must not happen is
 * `--update-baseline` deleting debt that nothing fixed.
 */
export function diffAgainstBaseline(
  results: ScanOutcome[],
  baseline: Baseline
): { regressions: string[]; stale: string[]; pruned: Baseline } {
  const regressions: string[] = []
  const stale: string[] = []
  const pruned: Baseline = { ...baseline, pages: { ...baseline.pages } }
  const seenByPage = new Map<string, Set<string>>()
  const crashed = new Set<string>()

  for (const result of results) {
    // A crashed scan is -1. It must never read as "no violations".
    if (result.violations < 0) {
      crashed.add(result.page)
      regressions.push(`${result.page} (${result.device}): the scan itself failed`)
      continue
    }
    const seen = seenByPage.get(result.page) ?? new Set<string>()
    seenByPage.set(result.page, seen)
    const accepted = new Set(baseline.pages[result.page] ?? [])
    for (const { id } of result.details) {
      seen.add(id)
      if (!accepted.has(id)) regressions.push(`${result.page} (${result.device}): ${id}`)
    }
  }

  for (const [page, ids] of Object.entries(baseline.pages)) {
    if (crashed.has(page)) continue
    const seen = seenByPage.get(page)
    if (!seen) {
      stale.push(`${page} is in the baseline but was not scanned`)
      delete pruned.pages[page]
      continue
    }
    for (const id of ids) {
      if (!seen.has(id)) stale.push(`${page}: ${id} no longer fires`)
    }
    pruned.pages[page] = ids.filter((id) => seen.has(id))
  }

  return { regressions, stale, pruned }
}

/** The baseline as it is checked in: two-space JSON, each page's ids on one line. */
export function serializeBaseline(baseline: Baseline): string {
  const json = JSON.stringify(baseline, null, 2).replace(
    /\[\n\s+("[^"\n]*"(?:,\n\s+"[^"\n]*")*)\n\s+\]/g,
    (_, items: string) => `[${items.split(/,\n\s+/).join(', ')}]`
  )
  return `${json}\n`
}
