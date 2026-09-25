/**
 * The shared engine behind `tools/check-styling.ts`'s three rule sets —
 * design tokens, styling ownership and srd's stylesheet entry.
 *
 * Those used to be three scripts, and two of them said in their own header that
 * one "mirrors the structure of" the other "exactly": each hand-rolled a
 * `walk()`, an exemption lookup, a baseline read, a ratchet comparison and a
 * report. Three copies of one idea drift in three directions — the styling
 * baseline recorded four rules pinned at zero that were ratchets in name only,
 * and the token ratchet let an improvement go unrecorded forever (raw-color
 * measured 21 against a baseline of 22, which meant one new violation could be
 * added back without failing anything).
 *
 * What the engine owns, so no rule set has to:
 *
 *   - **the walk** — `listFiles`, a `Bun.Glob` scan that never enters
 *     `node_modules`, `dist`, dot-directories or machine-written `generated/`
 *     trees;
 *   - **exemptions** — `isExempt`, one shape everywhere: a path fragment, the
 *     rules it waives, and a written reason;
 *   - **the verdict** — `evaluate`, which knows two kinds of rule:
 *       * `zero` — any finding fails. There is no baseline entry to maintain,
 *         because the only legal count is none;
 *       * `ratchet` — a committed baseline burning down. The count may not
 *         rise, AND it may not fall without the baseline falling with it: an
 *         unrecorded improvement is slack that the next regression spends.
 *   - **the baseline file** — one JSON document keyed by rule set, holding
 *     ratchet rules only.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type Finding = { file: string; line: number; detail: string }

export type RuleMode = 'zero' | 'ratchet'

export type Rule = {
  /** Stable id, used by exemptions and the baseline. */
  id: string
  /** Which law this enforces — cited back to the author on failure. */
  rule: string
  /** What to do instead. */
  fix: string
  mode: RuleMode
}

export type Exemption = { file: string; rules: readonly string[]; reason: string }

export type RuleSet = {
  /** Stable id: the baseline key and the `--only=` value. */
  id: string
  label: string
  rules: readonly Rule[]
  /**
   * Hard preconditions, run before the scan in the CLI (scan floors, workspace
   * coverage). They exit the process on failure, which is why tests call
   * `scan` directly against a fixture root instead.
   */
  preflight?: (root: string) => void
  /** Every rule's findings, keyed by rule id. Pure given `root`. */
  scan: (root: string) => Record<string, Finding[]>
  /** Findings printed as a warning and never gated. */
  advisory?: (root: string) => { id: string; findings: Finding[] }
  /** Where a genuinely-correct case is declared, printed after a failure. */
  exemptionsLive: string
  /** A line printed on success, after the count summary. */
  summary?: (root: string) => string
}

/** Rule set id -> ratchet rule id -> allowed count. */
export type Baseline = Record<string, Record<string, number>>

const SKIP_SEGMENTS = new Set(['node_modules', 'dist', 'generated'])

/**
 * Every file under `dirs` (repo-relative) whose name ends in one of
 * `extensions`, as sorted repo-relative paths.
 *
 * `generated/` is skipped because a machine-written file is not a place a
 * violation can be fixed — the only edit that survives is to the generator.
 * A missing directory yields nothing rather than throwing; the scan floors each
 * rule set asserts are what turn "found nothing" into a failure.
 */
export function listFiles(
  root: string,
  dirs: readonly string[],
  extensions: readonly string[]
): string[] {
  const exts = extensions.map((e) => e.replace(/^\./, ''))
  const pattern = exts.length === 1 ? `**/*.${exts[0]}` : `**/*.{${exts.join(',')}}`
  const glob = new Bun.Glob(pattern)
  const out = new Set<string>()
  for (const dir of dirs) {
    const base = join(root, dir)
    if (!existsSync(base)) continue
    for (const rel of glob.scanSync({ cwd: base, dot: false, followSymlinks: false })) {
      const segments = rel.split(/[\\/]/)
      if (segments.some((s) => SKIP_SEGMENTS.has(s) || s.startsWith('.'))) continue
      out.add(`${dir.replace(/\/$/, '')}/${segments.join('/')}`)
    }
  }
  return [...out].sort()
}

/** A path is exempt from a rule when an entry's `file` fragment occurs in it. */
export function isExempt(
  exemptions: readonly Exemption[],
  relPath: string,
  ruleId: string
): boolean {
  return exemptions.some((e) => relPath.includes(e.file) && e.rules.includes(ruleId))
}

export type RuleVerdict = {
  rule: Rule
  found: number
  allowed: number
  findings: Finding[]
  /** Why this rule fails, or null when it passes. */
  problem: 'nonzero' | 'regressed' | 'unrecorded-improvement' | null
}

export type SetVerdict = {
  set: RuleSet
  rules: RuleVerdict[]
  /** Baseline entries naming a rule that is not a ratchet rule of this set. */
  staleBaselineKeys: string[]
  ok: boolean
}

/** Compare one rule set's findings with its slice of the baseline. */
export function evaluate(
  set: RuleSet,
  results: Record<string, Finding[]>,
  baseline: Record<string, number> = {}
): SetVerdict {
  const rules = set.rules.map((rule): RuleVerdict => {
    const findings = results[rule.id] ?? []
    const found = findings.length
    if (rule.mode === 'zero') {
      return { rule, found, allowed: 0, findings, problem: found > 0 ? 'nonzero' : null }
    }
    const allowed = baseline[rule.id] ?? 0
    const problem =
      found > allowed ? 'regressed' : found < allowed ? 'unrecorded-improvement' : null
    return { rule, found, allowed, findings, problem }
  })
  const ratchetIds = new Set(set.rules.filter((r) => r.mode === 'ratchet').map((r) => r.id))
  const staleBaselineKeys = Object.keys(baseline).filter((id) => !ratchetIds.has(id))
  return {
    set,
    rules,
    staleBaselineKeys,
    ok: staleBaselineKeys.length === 0 && rules.every((r) => r.problem === null),
  }
}

/** The ratchet counts `--update-baseline` would write for one rule set. */
export function ratchetCounts(
  set: RuleSet,
  results: Record<string, Finding[]>
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const rule of set.rules) {
    if (rule.mode === 'ratchet') out[rule.id] = (results[rule.id] ?? []).length
  }
  return out
}

/**
 * Ratchet rules whose new count is HIGHER than the committed one.
 *
 * `--update-baseline` refuses these unless `--allow-increase` is passed. The one
 * legitimate reason is recorded in the design-token history: a rule made
 * STRICTER counts literals that were always there, and that commit may raise
 * the baseline once, with the reason written down. Drift may not.
 */
export function increases(
  previous: Record<string, number>,
  next: Record<string, number>
): string[] {
  return Object.entries(next)
    .filter(([id, n]) => n > (previous[id] ?? 0))
    .map(([id, n]) => `${id}: ${previous[id] ?? 0} → ${n}`)
}

export function readBaseline(path: string): Baseline {
  if (!existsSync(path)) return {}
  return JSON.parse(readFileSync(path, 'utf8')) as Baseline
}

/** Human-readable failure report for one set. Empty when the set passed. */
export function formatFailures(verdict: SetVerdict, updateCommand: string): string[] {
  const lines: string[] = []
  for (const r of verdict.rules) {
    if (r.problem === null) continue
    lines.push(`── ${verdict.set.id}/${r.rule.id} — ${r.rule.rule}`)
    if (r.problem === 'nonzero') {
      lines.push(`   must be zero, found ${r.found}`)
    } else if (r.problem === 'regressed') {
      lines.push(`   ${r.allowed} allowed, ${r.found} found (+${r.found - r.allowed})`)
    } else {
      lines.push(
        `   improved: baseline says ${r.allowed}, found ${r.found}. Lock the gain in —`,
        `   an unrecorded improvement is slack the next regression spends unnoticed.`,
        `   run: ${updateCommand}`
      )
      lines.push('')
      continue
    }
    lines.push(`   fix: ${r.rule.fix}`, '')
    for (const f of r.findings.slice(0, 25)) lines.push(`   ${f.file}:${f.line}  ${f.detail}`)
    if (r.findings.length > 25) lines.push(`   … and ${r.findings.length - 25} more`)
    lines.push('')
  }
  for (const key of verdict.staleBaselineKeys) {
    lines.push(
      `── ${verdict.set.id}: baseline names \`${key}\`, which is not a ratchet rule of this set.`,
      `   Zero rules carry no baseline. run: ${updateCommand}`,
      ''
    )
  }
  if (verdict.rules.some((r) => r.problem === 'nonzero' || r.problem === 'regressed')) {
    lines.push(
      `A genuinely-correct case needs an EXEMPTIONS entry in ${verdict.set.exemptionsLive}`
    )
    lines.push('(with a reason), not a higher number.', '')
  }
  return lines
}
