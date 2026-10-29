/**
 * The `design-tokens-ignore` line comment the `tokens` and `chrome-tokens`
 * rule sets honour: `design-tokens-ignore(<rule-id>[, <rule-id>…]): <reason>`.
 * It waives only the rules it names, on its own line, and only with a reason;
 * a bare marker waives nothing and is itself a finding (`tokens/ignore-marker`).
 */

const IGNORE_MARKER = 'design-tokens-ignore'

const NAMED_MARKER = /design-tokens-ignore\(\s*([a-z0-9-]+(?:\s*,\s*[a-z0-9-]+)*)\s*\)\s*:\s*(.*)$/

/** The text a marker runs to, its comment closer (`*\/`) dropped. */
function markerText(line: string): string | undefined {
  const at = line.indexOf(IGNORE_MARKER)
  if (at < 0) return undefined
  return line
    .slice(at)
    .replace(/\*\/.*$/, '')
    .trimEnd()
}

/** The rule ids a line's marker waives: none for no marker, a bare one, or one with no reason. */
export function ignoredRules(line: string): ReadonlySet<string> {
  const text = markerText(line)
  const m = text?.match(NAMED_MARKER)
  if (!m || !(m[2] ?? '').trim()) return new Set()
  return new Set((m[1] ?? '').split(',').map((id) => id.trim()))
}

/** What is wrong with a line's marker, given the rule ids a marker may name; empty when it is sound. */
export function markerProblems(line: string, known: ReadonlySet<string>): string[] {
  const text = markerText(line)
  if (text === undefined) return []
  const m = text.match(NAMED_MARKER)
  if (!m) return [`${text}: name the rule, \`${IGNORE_MARKER}(<rule-id>): <reason>\``]
  const out: string[] = []
  if (!(m[2] ?? '').trim()) out.push(`${text}: give the reason after the colon`)
  for (const id of (m[1] ?? '').split(',').map((s) => s.trim()))
    if (!known.has(id)) out.push(`${text}: \`${id}\` is no tokens or chrome-tokens rule`)
  return out
}
