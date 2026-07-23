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
    // Two guards keep this from firing on things that only LOOK like hex:
    //
    // 1. Length is restricted to VALID CSS hex-colour lengths — 3, 4, 6, 8. A
    //    run of any OTHER length is not a colour, so `#30581` and `#10005`
    //    (5-digit GitHub issue references, e.g. `microsoft/TypeScript#30581`,
    //    and the `&#10005;` ✕ character entity) no longer match. Previously the
    //    open `{3,8}` matched them and the rule punished citing an issue number
    //    in a comment — the same provenance-degrading false positive as PR refs.
    //
    // 2. `(?!\d{1,3}\b)` still excludes a 3-digit ALL-numeric run (`#466`, a PR
    //    ref, is a valid *length* but never a colour anyone means). That also
    //    drops a 3-digit all-numeric shorthand like `#000`; those are rare, live
    //    only in the already-exempt print stylesheet, and pure black/white are
    //    covered by the `pure-white` rule and the paper law regardless. A
    //    shorthand with any letter (`#fff`, `#a1b`) and every 6-/8-digit form is
    //    still caught. Colour-carrying matches lose nothing; prose stops firing.
    //
    // 3. `(?<!&)` excludes a `#` preceded by `&` — an HTML numeric character
    //    entity like `&#8599;` (↗) or `&#9670;` (◆) in JSX. A 4-digit entity is
    //    a valid hex *length*, so only the lookbehind can tell it from a colour.
    //
    // 4. The `rgb()` arm uses `(?<![a-zA-Z0-9])` where it used to use `\b`. This
    //    is not a cosmetic tidy: `_` is a WORD character, so `\b` never fired
    //    inside a Tailwind arbitrary value, where `_` is the space separator.
    //    Every `shadow-[0_5px_18px_rgba(...)]` in the codebase — the hover lifts
    //    on the catalog tile, the entity row, the wizard door — was invisible to
    //    this rule, which is the exact place raw colour is most likely to hide,
    //    since there is no shadow token ladder to reach for instead. The new
    //    lookbehind still refuses a letter or digit before `rgb`, so an
    //    identifier ending in it (`srgb(`) is not a false positive, while `_`,
    //    `(`, space and line-start all correctly count as a boundary.
    pattern:
      /(?<!&)#(?!\d{1,3}\b)(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|(?<![a-zA-Z0-9])rgba?\([^)]*\)/g,
  },
  {
    id: 'gradient',
    rule: 'ruleset §3.5 — no gradient SHADING (hard-stop patterns are allowed)',
    // The law bans smooth interpolation, not the CSS function — a gradient
    // whose stops are coincident paints flat bands and is a PATTERN. That
    // distinction is not reliably decidable by regex (stops can be var()s,
    // computed, or split across lines), so this matches every gradient and
    // sanctioned patterns are declared in EXEMPTIONS with a written reason.
    // Deliberately blunt: a false positive costs one exemption line, a false
    // negative lets real shading ship.
    fix: 'Use a solid token fill, or hard colour stops if you mean a pattern. Half-fills and X marks are clip-path or SVG, never gradient fills.',
    pattern: /linear-gradient|radial-gradient|conic-gradient/g,
  },
  {
    id: 'arbitrary-tracking',
    rule: 'ruleset §4.2 — the tracking ladder is tokens only',
    // NOTE — canon and code disagree here, and the code is what ships.
    // ruleset §4.2 declares THREE tokens (--tracking-label 0.04em,
    // --tracking-display 0.01em, --tracking-eyebrow 0.22em) and says the wide
    // HUD values "conform down to 0.04em". theme.css actually ships FIVE:
    // caps-tight 0.04 / caps-snug 0.06 / caps 0.08 / caps-wide 0.12 / eyebrow
    // 0.22 — `--tracking-label` and `--tracking-display` do not exist. This fix
    // text names the tokens that REALLY resolve, so it can't send anyone to a
    // non-existent utility. Reconciling the two (collapsing the ladder to 0.04
    // or amending the ruleset) is a separate, visual-delta decision.
    fix: 'Use the shipped ladder: tracking-caps-tight (0.04em, the canonical label/stamp tracking) / -caps-snug / -caps / -caps-wide / tracking-eyebrow (0.22em, brand caption only).',
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
    rules: ['raw-color', 'arbitrary-border-width'],
    reason:
      'The token definitions themselves — this file is where colour is allowed to be a literal. arbitrary-border-width is exempt for a different reason: the file authors no borders at all, it defines the --bw-* ladder. Its one match is the prose in the ladder doc-comment ("never `border-[1.5px]`") — the rule text quoting the form it forbids. Rewording the comment to dodge the regex would make the canon harder to read to satisfy a lint.',
  },
  {
    file: 'packages/component-lib/src/components/chrome/Slab.tsx',
    rules: ['gradient'],
    reason:
      'Named exemption in canonical-primitive-language.md §Known-deviations: the Slab dashed leader is a deliberate control-panel shape built on ink tokens.',
  },
  {
    file: 'packages/component-lib/src/stories',
    rules: [
      'raw-color',
      'arbitrary-font-size',
      'arbitrary-tracking',
      'arbitrary-border-width',
      'pure-white',
      'gradient',
    ],
    reason:
      'Foundations catalog pages render token specimens and deliberately show off-system values as counter-examples. arbitrary-border-width is on the list for exactly that reason: the sole match is Theme.stories.tsx printing the border ladder\'s own caption, "never border-[1.5px]" — the counter-example is the content. (This entry is the directory, so it also covers the two non-story helpers here, _harness.tsx and _dashboardStage.tsx.)',
  },
  {
    file: '.stories.tsx',
    rules: [
      'raw-color',
      'arbitrary-font-size',
      'arbitrary-tracking',
      'arbitrary-border-width',
      'pure-white',
    ],
    reason:
      'Ladle stories are specimens, not shipped surfaces — the same standing the Foundations catalog pages above already have, extended to the co-located ones so the rule does not depend on which directory a story happens to live in. Their literals are harness scaffolding: the --tone/--ground custom properties the consuming APP supplies at runtime (ModeDoor, VitalGauge), a dark backdrop to prove contrast against, a #ccc outline on a resize container (DashboardGrid/DashboardCanvas), and swatch props fed as data (FilterChip). Nothing here reaches a user, and tokenising a stand-in for app-supplied context would make the story demonstrate something other than what ships. Note the cost, since it is real: stories are where new surfaces get prototyped, so this is the one place drift can incubate un-flagged — a literal that graduates from a story into a component is caught at the component, not here. `gradient` is deliberately NOT on this list: a gradient is banned by §3.5 on shading grounds that a specimen does not escape, and the one sanctioned story gradient (CatalogTile.stories.tsx) is named individually below.',
  },
  {
    file: 'packages/component-lib/src/components/chrome/catalogTile.ts',
    rules: ['gradient'],
    reason:
      'Named exemption in ruleset §3.5: the srd catalog tile ramps (--catalog-bg) carry the tech-level and ability-tier ramps on the landing page. The ramp is a wayfinding cue, not decoration. The exemption moved here from shared/CatalogTile.tsx along with the treatment itself: the only match is the doc comment explaining WHY the fill must use the `background` shorthand — it names the `linear-gradient()` that `background-color` silently drops. That comment is the reason the bug stays fixed, so it is not reworded to dodge the regex.',
  },
  {
    file: 'apps/srd/src/lib/catalogColors.ts',
    rules: ['gradient', 'raw-color'],
    reason:
      'Named exemption in ruleset §3.5: the source of the catalog tile ramps CatalogTile renders. Same wayfinding rationale.',
  },
  {
    file: 'packages/component-lib/src/components/shared/CatalogTile.stories.tsx',
    rules: ['gradient'],
    reason:
      'Ruleset §3.5 hard-stop pattern: the story restates the real tech-level ramp (six coincident-stop bands, no blending) because component-lib cannot import catalogColors from an app. Exempt for the same reason the component it demonstrates is.',
  },
  {
    file: 'apps/itun/src/components/sheet/ShareSnapshotScreen.tsx',
    rules: ['gradient'],
    reason:
      'Ruleset §3.5 hard-stop pattern: the QR placeholder is a repeating-conic checkerboard on ink/paper tokens. A checkerboard is a pattern, not shading.',
  },
  {
    file: 'apps/srd/src/styles/global.css',
    rules: ['gradient', 'raw-color'],
    reason:
      'Ruleset §3.5 THE one-off: the .pilot-panel distressed-metal effect on srd /about is a CSS illustration, ruled a sanctioned one-off. It is the single place smooth shading is allowed, and it is allowed because it is a picture of a rusted plate rather than a UI surface. Not precedent — no second one-off without an explicit ruling. raw-color rides along because it is the SAME illustration: the rust blooms, the steel plate, the rivet heads and the engraved lettering are one picture, and a picture needs more shades than a UI palette has — the rivets alone spend nine greys on lit/worn/green/flush/hole. Tokenising them would add a dozen tokens nothing else could ever reuse. CAVEAT, since a file-level exemption is blunter than the rationale: it also swallows three literals outside the illustration block — the .catalog-item hover box-shadow and .catalog-item__name text-shadow (real shadow debt on an authored surface, still owed a token) and one #fff in the print block. Line-scoping the exemption was considered and rejected as too brittle to survive edits to this file; they are recorded here instead of silently absorbed.',
  },
  {
    file: 'packages/salvageunion-reference/lib/schemas/entities.ts',
    rules: ['raw-color'],
    reason:
      "A DATA contract, not a styling call site. `guideColor` is an authored per-guide hex whose Zod schema enforces `^#[0-9a-fA-F]{6}$` — `var(--color-ink)` is not a legal value for that field, so its default cannot be a token reference no matter how much we would like it to be. The rule the guard is really enforcing (use OUR palette) is still applied: the default is the canonical ink's own hex, #282019, not the pure black it used to be.",
  },
  {
    file: 'packages/component-lib/src/components/shared/KofiButton.tsx',
    rules: ['raw-color'],
    reason:
      "EXTERNAL BRAND colour, not ours. #72a4f2 is Ko-fi's own blue, the default fill for their button; the widget is recognisable BECAUSE it is that colour, so resolving it to a Salvage Union token would misrepresent someone else's mark. This is the standing rule for third-party marks: a colour we source from an external brand keeps the external value, and anything sourced to OUR design uses the canonical set. Note the prop is caller-overridable, so a consumer that wants a themed button already can.",
  },
  {
    file: 'apps/itun/src/styles/print.css',
    rules: ['raw-color', 'pure-white'],
    reason:
      'PRINT MEDIA. Inside `@media print` the surface is physical paper and the ink is real ink, so #fff / #000 are the correct values rather than the screen palette — warm paper (#fbfaf7) printed as a fill wastes toner and reads grey. theme.css already carves out exactly this exception in its paper note ("the only remaining #ffffff is one scoped exception: the @media print sheet"); this is that exception, in the app that owns the sheet.',
  },
  {
    file: 'apps/itun/src/index.css',
    rules: ['raw-color', 'pure-white'],
    reason:
      'Same print exception as styles/print.css above — the literals here are all inside the print/PDF-export block that forces a true-white ground for the live sheet.',
  },
  {
    file: 'packages/component-lib/src/components/referenceEntity/card/entityCardTone.ts',
    rules: ['raw-color'],
    reason:
      "Self-citation, not a colour: the sole match is a doc comment describing the `hostBase` parameter as accepting a resolvable CSS colour, naming the `rgb()` form it accepts. The rule matches the empty-parens spelling. Rewording the comment to dodge the regex would make the parameter's contract less clear to satisfy a lint — the same trade the raw-color rule already refuses for PR and issue references.",
  },
  {
    file: 'apps/srd/src/pages/greembeem.astro',
    rules: ['raw-color'],
    reason:
      "Not an SRD surface. This is a standalone novelty page — a Wikipedia pastiche for an in-joke episode list — that is `noindex, nofollow`, excluded from the sitemap in astro.config.mjs, linked from nowhere in the repo, and carries its own self-contained inline <style> importing nothing from the theme. Its literals ARE the joke: #a2a9b1 borders, #f8f9fa chrome and #3366cc links are MediaWiki's palette, and reskinning them in Salvage Union tokens would destroy the only thing the page does. It shares the deploy, not the design system.",
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
    // Generated files and test fixtures are not authored surfaces. Test files
    // are here rather than in EXEMPTIONS because it is a category, not a
    // judgement call about one file: a colour literal in a test is an ASSERTION
    // about behaviour (`expect(borderColorFromHeaderBg('bg-pilot', '#D46A30'))
    // .toBe('#D46A30')` — the point of the case is that an arbitrary override
    // passes through untouched). Tokenising it would delete the test.
    if (relPath.includes('.gen.') || relPath.includes('routeTree')) continue
    if (relPath.includes('__tests__') || /\.test\.[tj]sx?$/.test(relPath)) continue

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
 *
 * ONE SANCTIONED EXCEPTION to "only ever downward", recorded because a silent
 * upward bump is exactly what this ratchet exists to prevent: when a rule is
 * made STRICTER, its count rises without anyone having written a new violation.
 * That happened once, to `raw-color` (11 -> 35), when its `rgb()` arm stopped
 * using `\b` — a boundary that could never fire inside a Tailwind arbitrary
 * value, because `_` is a word character. The 24 newly-counted literals are all
 * pre-existing `shadow-[..._rgba(...)]` / `[text-shadow:..._rgba(...)]` values
 * that had been present and uncounted; not one of them is new drift.
 *
 * They are baselined rather than fixed because there is no shadow/scrim token
 * ladder to convert them to — inventing one is a design decision with real
 * visual consequences across the wizard doors, roll tables and hover lifts, not
 * a lint cleanup. The debt is now VISIBLE and frozen, which is the point.
 *
 * The rule stands: a stricter rule may rebaseline upward ONCE, in the same
 * commit that tightens it, with the reason written down. Drift may not.
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
