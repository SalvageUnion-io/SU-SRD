/**
 * The shared engine behind `tools/check-rule-sets.ts`'s rule sets — design
 * tokens, styling ownership, the stylesheet entry, the copy lint and more.
 *
 * One engine, because three copies of a `walk()`, an exemption lookup and a
 * report drift in three directions.
 *
 * What the engine owns, so no rule set has to:
 *
 *   - **the walk** — `listFiles`, a `Bun.Glob` scan that never enters
 *     `node_modules`, `dist`, dot-directories or machine-written `generated/`
 *     trees;
 *   - **exemptions** — `isExempt`, one shape everywhere: a path fragment, the
 *     rules it waives, and a written reason;
 *   - **the verdict** — `evaluate`: every rule is `zero`, so any finding
 *     fails and no count is recorded anywhere.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type Finding = { file: string; line: number; detail: string }

type RuleMode = 'zero'

export type Rule = {
  /** Stable id, used by exemptions. */
  id: string
  /** Which law this enforces — cited back to the author on failure. */
  rule: string
  /** What to do instead. */
  fix: string
  mode: RuleMode
}

export type Exemption = { file: string; rules: readonly string[]; reason: string }

export type RuleSet = {
  /** Stable id: the `--only=` value. */
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
  /** Where a genuinely-correct case is declared, printed after a failure; none
   *  for a set that takes no exemptions. */
  exemptionsLive?: string
  /** A line printed on success, after the count summary. */
  summary?: (root: string) => string
}

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

type RuleVerdict = {
  rule: Rule
  found: number
  findings: Finding[]
}

export type SetVerdict = {
  set: RuleSet
  rules: RuleVerdict[]
  ok: boolean
}

/** One rule set's findings as a verdict: any finding fails its rule. */
export function evaluate(set: RuleSet, results: Record<string, Finding[]>): SetVerdict {
  const rules = set.rules.map((rule): RuleVerdict => {
    const findings = results[rule.id] ?? []
    return { rule, found: findings.length, findings }
  })
  return { set, rules, ok: rules.every((r) => r.found === 0) }
}

/** Human-readable failure report for one set. Empty when the set passed. */
export function formatFailures(verdict: SetVerdict): string[] {
  const lines: string[] = []
  for (const r of verdict.rules) {
    if (r.found === 0) continue
    lines.push(`── ${verdict.set.id}/${r.rule.id} — ${r.rule.rule}`)
    lines.push(`   must be zero, found ${r.found}`)
    lines.push(`   fix: ${r.rule.fix}`, '')
    for (const f of r.findings.slice(0, 25)) lines.push(`   ${f.file}:${f.line}  ${f.detail}`)
    if (r.findings.length > 25) lines.push(`   … and ${r.findings.length - 25} more`)
    lines.push('')
  }
  if (!verdict.ok) {
    if (verdict.set.exemptionsLive === undefined) {
      lines.push('This law takes no exemptions: make the fix above.', '')
    } else {
      lines.push(
        `A genuinely-correct case needs an EXEMPTIONS entry in ${verdict.set.exemptionsLive}`
      )
      lines.push('(with a reason).', '')
    }
  }
  return lines
}
