/**
 * Shared structured-diagnostic shape for the validation tooling.
 *
 * Every check (existing and new) converges on this shape so `tools/validate.ts`
 * can print one consistent report and group/filter uniformly, regardless of
 * which of the 8 checks produced a given diagnostic.
 */

export type Diagnostic = {
  /** Which check produced this diagnostic, e.g. "ids", "slugs", "orphans". */
  check: string
  /** Data file the diagnostic concerns, e.g. "chassis.json". */
  file: string
  /**
   * A JSON-pointer-ish or breadcrumb location within `file` — as specific as
   * the underlying check can make it (array index, nested field path, and/or
   * entity name). Not a strict RFC 6901 JSON Pointer: several checks key by
   * entity name rather than array index, so this preserves whatever
   * specificity each check already had rather than forcing a lossy index-only
   * format.
   */
  path: string
  /** Human-readable description of the problem. */
  message: string
}

/** Group diagnostics by `check`, preserving first-seen order. */
export function groupByCheck(diagnostics: Diagnostic[]): Map<string, Diagnostic[]> {
  const grouped = new Map<string, Diagnostic[]>()
  for (const d of diagnostics) {
    const bucket = grouped.get(d.check)
    if (bucket) bucket.push(d)
    else grouped.set(d.check, [d])
  }
  return grouped
}

/** Group diagnostics by `file`, preserving first-seen order. */
export function groupByFile(diagnostics: Diagnostic[]): Map<string, Diagnostic[]> {
  const grouped = new Map<string, Diagnostic[]>()
  for (const d of diagnostics) {
    const bucket = grouped.get(d.file)
    if (bucket) bucket.push(d)
    else grouped.set(d.file, [d])
  }
  return grouped
}
