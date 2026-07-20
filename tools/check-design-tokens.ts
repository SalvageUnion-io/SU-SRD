#!/usr/bin/env bun
/**
 * Design-token guardrails — `bun run check:tokens`.
 *
 * Plan phase 6 of the canonical primitive language (docs/design-system/
 * canonical-primitive-language.md §4) specified these checks and they were never
 * built. Their absence is why the `su-*` shadow token family survived: the drift
 * was never raw hex (which reads as obviously wrong), it was a parallel token
 * family that *looked* sanctioned at every call site.
 *
 * Why this must exist as a build step rather than a review habit: these tokens
 * are Tailwind v4 `@theme` entries, so a deleted token does not fail typecheck —
 * the utility simply stops being generated and the element renders unstyled.
 * There is no compiler backstop for this class of mistake. This script is it.
 *
 * Every rule maps to a law in docs/design-system/ruleset.md; the `rule` field
 * cites the section so a failure tells you which law you broke, not just which
 * regex you tripped.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dir, '..')

const SCAN_DIRS = [
  'packages/component-lib/src',
  'packages/salvageunion-reference/lib',
  'apps/srd/src',
  'apps/itun/src',
]

const SCAN_EXTENSIONS = ['.ts', '.tsx', '.astro', '.css']

type Rule = {
  /** Stable id, used by the exemption list. */
  id: string
  /** Which law this enforces — cited back to the author on failure. */
  rule: string
  /** What to do instead. */
  fix: string
  pattern: RegExp
  /** Files this rule never applies to (globs are substring matches on the repo-relative path). */
  skip?: string[]
}

const RULES: Rule[] = [
  {
    id: 'shadow-tokens',
    rule: 'ruleset §0/§4.1 — one closed colour set',
    fix: 'Use the canonical token: su-orange→pilot, su-orange-dark→rust, su-green→mech, su-green-dark→mech-dark, su-pink→crawler, su-black→ink, su-blue-pale→wk-bg, su-orange-light/su-peach→pilot-light, su-rust→adversary, su-paper→paper (or band-cream in RollTable bands), greys→ink-75/50/30/12/8.',
    // The `su-` colour family only. `.su-section-header` / `.su-print-hidden`
    // are plain CSS class names in an app stylesheet, not @theme tokens, so the
    // boundary here is the utility-prefix / var() form, not the bare string.
    pattern:
      /(?:\b(?:bg|text|border|ring|outline|fill|stroke|decoration|from|via|to|shadow|accent|caret|divide)-su-[a-z0-9-]+)|(?:--color-su-[a-z0-9-]+)/g,
  },
  {
    id: 'raw-color',
    rule: 'ruleset §4.1 — colour lives in tokens, not call sites',
    fix: 'Add or reuse a token in theme.css and reference it via a Tailwind utility or var(--color-*).',
    pattern: /#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)/g,
  },
  {
    id: 'gradient',
    rule: 'ruleset §3.5 — no gradients, anywhere',
    fix: 'Use a solid token fill. Half-fills and X marks are clip-path or SVG, never gradient fills.',
    pattern: /linear-gradient|radial-gradient|conic-gradient/g,
  },
  {
    id: 'arbitrary-tracking',
    rule: 'ruleset §4.2 — three tracking tokens, not fifteen',
    fix: 'Use tracking-label (0.04em) / tracking-display (0.01em) / tracking-eyebrow (0.22em).',
    pattern: /tracking-\[[^\]]+\]/g,
  },
  {
    id: 'arbitrary-border-width',
    rule: 'ruleset §4.3 — border weights are tokens, one meaning each',
    fix: 'Use border-entity (3px) / border-entity-compact (2px) / border-chrome (1.5px) / border (1px hairline).',
    // Only widths — `border-[color:var(--x)]` is a colour, covered by raw-color.
    pattern: /border(?:-[trblxy])?-\[\d*\.?\d+px\]/g,
  },
  {
    id: 'arbitrary-font-size',
    rule: 'ruleset §4.2 — one type scale',
    fix: 'Use the semantic ladder: text-nano / micro / label / label-lg / badge / note / caption / lede.',
    pattern: /text-\[\d*\.?\d+(?:px|rem)\]/g,
  },
  {
    id: 'pure-white',
    rule: 'ruleset §4.1 — pure white is retired; paper (#fbfaf7) is the one light surface',
    fix: 'Use bg-paper / text-paper.',
    pattern: /\b(?:bg|text|border|ring|fill|stroke)-white\b/g,
  },
]

/**
 * Sanctioned literals. Each entry needs a reason — an exemption without a
 * justification is just a silent hole in the guardrail.
 */
const EXEMPTIONS: { file: string; rules: string[]; reason: string }[] = [
  {
    file: 'packages/component-lib/src/styles/theme.css',
    rules: ['raw-color'],
    reason:
      'The token definitions themselves — this file is where colour is allowed to be a literal.',
  },
  {
    file: 'packages/component-lib/src/components/chrome/Slab.tsx',
    rules: ['gradient'],
    reason:
      'Named exemption in canonical-primitive-language.md §Known-deviations: the Slab dashed leader is a deliberate control-panel shape built on ink tokens.',
  },
  {
    file: 'packages/component-lib/src/stories',
    rules: ['raw-color', 'arbitrary-font-size', 'arbitrary-tracking', 'pure-white', 'gradient'],
    reason:
      'Foundations catalog pages render token specimens and deliberately show off-system values as counter-examples.',
  },
]

function walk(dir: string): string[] {
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (SCAN_EXTENSIONS.some((ext) => entry.endsWith(ext))) out.push(full)
  }
  return out
}

function isExempt(relPath: string, ruleId: string): boolean {
  return EXEMPTIONS.some((e) => relPath.includes(e.file) && e.rules.includes(ruleId))
}

type Violation = { file: string; line: number; text: string; match: string; rule: Rule }

const violations: Violation[] = []

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const relPath = relative(ROOT, file)
    // Generated files and test fixtures are not authored surfaces.
    if (relPath.includes('.gen.') || relPath.includes('routeTree')) continue

    const lines = readFileSync(file, 'utf8').split('\n')
    for (const rule of RULES) {
      if (isExempt(relPath, rule.id)) continue
      if (rule.skip?.some((s) => relPath.includes(s))) continue

      lines.forEach((text, i) => {
        // A line may opt out with a cited reason.
        if (text.includes('design-tokens-ignore')) return
        const matches = text.match(rule.pattern)
        if (matches) {
          for (const match of matches) {
            violations.push({ file: relPath, line: i + 1, text: text.trim(), match, rule })
          }
        }
      })
    }
  }
}

const byRule = new Map<string, Violation[]>()
for (const v of violations) {
  const list = byRule.get(v.rule.id) ?? []
  list.push(v)
  byRule.set(v.rule.id, list)
}

/**
 * The ratchet.
 *
 * Killing the `su-*` shadow family was one directive; the other rules surfaced
 * ~345 pre-existing violations that predate this check. Blocking CI on all of
 * them would mean either a mega-commit nobody can review or (far more likely) a
 * guardrail that gets switched off — which is how the drift accumulated in the
 * first place. So: every rule is enforced from its current count downward. New
 * violations fail immediately; the existing backlog burns down incrementally and
 * can never grow. `shadow-tokens` has a baseline of 0 and is therefore fully
 * enforced today.
 *
 * Rebaseline (only ever downward) with: bun run check:tokens --update-baseline
 */
const BASELINE_PATH = join(import.meta.dir, 'design-tokens-baseline.json')

type Baseline = Record<string, number>

const counts: Baseline = {}
for (const rule of RULES) counts[rule.id] = byRule.get(rule.id)?.length ?? 0

if (process.argv.includes('--update-baseline')) {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(BASELINE_PATH, `${JSON.stringify(counts, null, 2)}\n`)
  console.log('✓ baseline written:', BASELINE_PATH)
  for (const [id, n] of Object.entries(counts)) console.log(`   ${id}: ${n}`)
  process.exit(0)
}

let baseline: Baseline = {}
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
} catch {
  console.error(
    `No baseline at ${BASELINE_PATH}. Create it with: bun run check:tokens --update-baseline`
  )
  process.exit(1)
}

const regressions: string[] = []
const improvements: string[] = []
for (const rule of RULES) {
  const now = counts[rule.id]
  const was = baseline[rule.id] ?? 0
  if (now > was) regressions.push(rule.id)
  else if (now < was) improvements.push(`${rule.id}: ${was} → ${now}`)
}

if (regressions.length === 0) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  console.log(`✓ design tokens: no new violations (${total} known, burning down)`)
  if (improvements.length > 0) {
    console.log('  improved — lower the baseline with `bun run check:tokens --update-baseline`:')
    for (const i of improvements) console.log(`    ${i}`)
  }
  process.exit(0)
}

console.error('\n✗ NEW design-token violations introduced\n')
for (const ruleId of regressions) {
  const list = byRule.get(ruleId) ?? []
  const rule = RULES.find((r) => r.id === ruleId)
  if (!rule) continue
  const was = baseline[ruleId] ?? 0
  console.error(`── ${ruleId} — ${rule.rule}`)
  console.error(`   ${was} allowed, ${list.length} found (+${list.length - was})`)
  console.error(`   fix: ${rule.fix}\n`)
  for (const v of list.slice(0, 25)) console.error(`   ${v.file}:${v.line}  ${v.match}`)
  if (list.length > 25) console.error(`   … and ${list.length - 25} more`)
  console.error('')
}
console.error('An off-system literal that is genuinely correct needs either an EXEMPTIONS entry')
console.error(
  'in tools/check-design-tokens.ts (with a reason) or a `design-tokens-ignore` comment.\n'
)
process.exit(1)
