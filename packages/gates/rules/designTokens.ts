/**
 * Design-token laws — the `tokens` rule set of `tools/check-styling.ts`.
 *
 * Nothing enforced these laws before this rule set. That absence is why the
 * `su-*` shadow token family survived: the drift was never raw hex (which reads
 * as obviously wrong), it was a parallel token family that *looked* sanctioned
 * at every call site.
 *
 * Why this must exist as a build step rather than a review habit: these tokens
 * are CSS custom properties, so a deleted token does not fail typecheck — the
 * `var()` that reads it simply resolves to nothing and the element renders
 * unstyled.
 * There is no compiler backstop for this class of mistake. This rule set is it.
 *
 * Every rule maps to a law in docs/design-system/ruleset.md; the `rule` field
 * cites the section so a failure tells you which law you broke, not just which
 * regex you tripped.
 *
 * ## Every rule is zero
 *
 * Every rule here is `zero`: any finding fails, and none has a baseline entry.
 * `rust-allowlist` (§3.1), `type-floor` (§4.6) and `texture-placement` (§3.5)
 * hold the Workshop Manual canon the ruleset ratifies. The Discord bot's
 * hex-integer accents are exempt from `raw-color` below (Discord's API takes
 * integers, not CSS). Making a rule stricter means fixing or exempting what
 * it newly finds in the same commit; there is no baseline to raise.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Exemption, Finding, Rule, RuleSet } from '../lib/ruleEngine'
import { isExempt, listFiles } from '../lib/ruleEngine'
import { assertScanFloor } from '../lib/scanFloor'
import { assertCoversWorkspaces } from '../lib/workspaceCoverage'

const SCAN_DIRS = [
  'packages/salvageunion-reference/lib',
  // The DATASET, not just the code that reads it (`.json` included): a raw hex
  // in the data would be a second palette. The data names no colour (a guide's
  // tone is derived, `guideTone()`); scanning this directory keeps it so.
  'packages/salvageunion-reference/data',
  'apps/web/src',
  // An entire APP the guard could not see. Its accent colours restate the
  // palette as hex ints (the `0x` arm of raw-color), the form Discord's API
  // takes; those two files are exempt below, so a new literal anywhere else in
  // the bot still fails.
  'apps/discord-bot/src',
  'apps/su-assets/src',
  'packages/observability/src',
  'packages/cantina-domain/src',
]

// greembeem (a MediaWiki-palette novelty page) ships as a static file under
// apps/web/public/, which this check does not scan, so it needs no raw-color
// exemption here.
const SCAN_EXTENSIONS = ['.ts', '.tsx', '.css', '.json']

type TokenRule = Rule & {
  pattern: RegExp
  /** Files this rule never applies to (substring matches on the repo-relative path). */
  skip?: string[]
  /**
   * Keep a match only when this holds — for a law a pattern alone cannot
   * decide: "under 11px" needs arithmetic, and "on a forbidden surface" needs
   * the file's path and the rest of the line.
   */
  keep?: (match: string, line: string, file: string) => boolean
}

/**
 * The px a font-size literal renders at, or `undefined` when it is not a
 * literal this can size (a retired rung's NAME, which is sub-floor by
 * definition). A unitless number is px, as a React style object reads it.
 */
export function fontSizePx(match: string): number | undefined {
  const m = match.match(/(\d*\.?\d+)(px|rem)?(?![\d.])/)
  if (!m) return undefined
  const n = Number(m[1])
  return m[2] === 'rem' ? n * 16 : n
}

/** The type floor (ruleset §4.6): nothing renders under 11px. */
const TYPE_FLOOR_PX = 11

/**
 * Where the light speckle may never sit (ruleset §3.5 "Texture"): buttons,
 * fields, the Dashboard and tooltips, by the files that draw them. Paper, the
 * fifth surface, is not a file — it is caught on the line instead (see
 * `PAPER_GROUND`).
 */
const TEXTURE_FORBIDDEN: readonly RegExp[] = [
  // The Dashboard: The Cantina's cockpit and its stylesheets.
  /\/dashboard\//,
  /\/Dashboard\w*\.(?:tsx?|css)$/,
  // Buttons: Button, its recipe, and every *Button component.
  /Button\w*\.tsx?$/,
  /\/buttonVariants\.ts$/,
  // Fields: the input primitives.
  /\/(?:atoms|containers)\/(?:Field|FieldError|InlineEditField|inputs|Sel|Radio|RadioCardGroup|CountStepper)\.tsx$/,
  /\/SearchField\.tsx$/,
  // Tooltips: the tooltip primitive, and the Peek (the entity's compact card).
  /Tooltip\w*\.tsx$/,
  /\/entity\/Peek\w*\.tsx$/,
]

/** A paper GROUND on the same line — the speckle never sits on paper. */
const PAPER_GROUND =
  /(?<![\w-])bg-paper(?![\w-])|background(?:-color|Color)?\s*:\s*(?:var\(--color-paper\)|color\.paper\b)/

const TOKEN_RULES: TokenRule[] = [
  {
    id: 'shadow-tokens',
    mode: 'zero',
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
    mode: 'zero',
    rule: 'ruleset §4.1 — colour lives in tokens, not call sites',
    fix: 'Add or reuse a token in theme.css (and its mirror in tokens.ts): `color.<name>` in a style object, `var(--color-<name>)` in a stylesheet rule. A translucent shade of a token is `color-mix(in oklab, var(--color-<name>) NN%, transparent)`.',
    // Two guards keep this from firing on things that only LOOK like hex:
    //
    // 1. Length is restricted to VALID CSS hex-colour lengths — 3, 4, 6, 8. A
    //    run of any OTHER length is not a colour, so `#30581` and `#10005`
    //    (5-digit GitHub issue references, e.g. `microsoft/TypeScript#30581`,
    //    and the `&#10005;` ✕ character entity) do not match. An open `{3,8}`
    //    would punish citing an issue number in a comment — the same
    //    provenance-degrading false positive as PR refs.
    //
    // 2. `(?!\d{1,3}\b)` still excludes a 3-digit ALL-numeric run (`#466`, a PR
    //    ref, is a valid *length* but never a colour anyone means). That also
    //    drops a 3-digit all-numeric shorthand like `#000`; those are rare and
    //    live only in the already-exempt print stylesheet. A
    //    shorthand with any letter (`#fff`, `#a1b`) and every 6-/8-digit form is
    //    still caught. Colour-carrying matches lose nothing; prose stops firing.
    //
    // 3. `(?<!&)` excludes a `#` preceded by `&` — an HTML numeric character
    //    entity like `&#8599;` (↗) or `&#9670;` (◆) in JSX. A 4-digit entity is
    //    a valid hex *length*, so only the lookbehind can tell it from a colour.
    //
    // 4. The `rgb()` arm uses `(?<![a-zA-Z0-9])`, not `\b`: `_` is a WORD
    //    character, so `\b` never fires inside a bracketed class value, where
    //    `_` is the space separator, and every `shadow-[0_5px_18px_rgba(...)]`
    //    would be invisible to this rule — the exact place raw colour is most
    //    likely to hide, since there is no shadow token ladder to reach for
    //    instead. The lookbehind still refuses a letter or digit before `rgb`, so an
    //    identifier ending in it (`srgb(`) is not a false positive, while `_`,
    //    `(`, space and line-start all correctly count as a boundary.
    pattern:
      /(?<!&)#(?!\d{1,3}\b)(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|(?<![a-zA-Z0-9])rgba?\([^)]*\)|(?<![a-zA-Z0-9_])0x[0-9a-fA-F]{6}\b/g,
  },
  {
    id: 'gradient',
    mode: 'zero',
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
    id: 'type-floor',
    mode: 'zero',
    rule: 'ruleset §4.6 — the 11px type floor, no exceptions',
    // Board 04 ("raise the floor"): the four rungs under 11px carried most of
    // the stamps and stat labels — exactly the words a player squints at
    // mid-combat. They were retired into `badge`, and this keeps them retired:
    // a retired rung's NAME is a finding (in any spelling — utility, custom
    // property, token key, caps-recipe class), and so is any LITERAL size
    // under 11px (an arbitrary utility, a CSS declaration, a style-object or
    // SVG `fontSize`).
    fix: 'Use `fontSize.badge` / `var(--text-badge)` / `text-badge` (11px) — the floor. A caps label at the floor reads at `tracking.capsSnug` (0.06em). Nothing renders smaller, seam and roll-table stamps included.',
    pattern:
      /(?<![\w-])text-(?:nano|micro|label(?:-lg)?)(?![\w-])|--text-(?:nano|micro|label(?:-lg)?)(?![\w-])|\bfontSize\.(?:nano|micro|label|labelLg)\b|\bsu-caps--(?:nano|micro|label(?:-lg)?)\b|text-\[\d*\.?\d+(?:px|rem)\]|font-size\s*:\s*\d*\.?\d+(?:px|rem)?(?![\w.])|\bfont[sS]ize\s*[=:]\s*\{?\s*['"`]?\d*\.?\d+(?:px|rem)?(?![\w.])/g,
    keep: (match) => {
      const px = fontSizePx(match)
      return px === undefined || px < TYPE_FLOOR_PX
    },
  },
  {
    id: 'rust-allowlist',
    mode: 'zero',
    rule: 'ruleset §3.1 — rust = action, only action (Button / buttonVariants / InlineRef)',
    // Rust had leaked into chrome as a brand accent — the ".io" and "Beta"
    // marks, section headings, the "you are here" state, link text, focus and
    // selection rings — and `--color-sheet-pilot-deep` aliased it outright, so
    // nothing on screen said "this does something" any more (board 03, issue
    // register #7). Every spelling of the rust family counts: the custom
    // property (rust, rust-hi, rust-25), a utility-style class under any
    // variant prefix, and the `color.rust*` token keys.
    fix: 'Rust is painted only by `Button` / `buttonVariants` (every action) and `InlineRef` (an inline link). A link in prose is `InlineRef`; a heading or a "here" state is ink (an ink Slab, an inverse stamp); a focus or selection ring is ink. Never alias a token to rust.',
    pattern:
      /--color-rust(?:-[a-z0-9]+)?(?![\w-])|\b(?:bg|text|border(?:-[trblxy])?|ring|ring-offset|outline|fill|stroke|decoration|from|via|to|shadow|accent|caret|divide)-rust(?:-hi|-25)?(?![\w-])|\bcolor\.rust(?:Hi|25)?\b/g,
  },
  {
    id: 'texture-placement',
    mode: 'zero',
    rule: 'ruleset §3.5 — the speckle sits on bands and ink, never on paper, buttons, fields, the Dashboard or tooltips',
    // The light speckle (board 05c) is ink grain on a colour band and paper
    // flecks on an ink ground. On a button it reads as dirt on the one thing
    // that must read clean; on a field it fights the text being typed; on a
    // tooltip it is noise at glance size; the Dashboard is an instrument; and
    // on paper there is no band for it to belong to. A texture reference —
    // a filter id, a `--texture-*` property or the `texture` / `speckle`
    // tokens — is a finding in a file that draws one of those surfaces, or on
    // a line that also paints a paper ground.
    fix: 'Put the speckle on the colour band or ink ground behind the content (a chapter band, a tone header, an ink banner, the Union bar), never on paper, a button, a field, the Dashboard or a tooltip.',
    pattern:
      /\bsu-(?:blot|speck|fleck)\b|--texture-[a-z-]+|\b(?:texture|speckle)\.(?:blotOpacity|speckOpacity|fleckOpacity|filters|grains)\b|\btokens\.(?:texture|speckle)\b/g,
    keep: (_match, line, file) =>
      TEXTURE_FORBIDDEN.some((zone) => zone.test(file)) || PAPER_GROUND.test(line),
  },
  {
    id: 'cool-ground',
    mode: 'zero',
    rule: 'ruleset §4.1 — one workshop ground; the cool `wk-bg-2` is off the closed palette',
    // The pale blue-grey (#d7e6ee) is what the page ground was before the brand
    // refresh moved it to the book's warm paper. It survived as a
    // second "ground" on a quiet chip and a search row, which put the cool
    // palette back on a warm page. Every spelling counts: the custom property,
    // a utility-style class under any prefix, and the `color.wkBg2` token key.
    // "Print" means the print stylesheet only (`apps/web/src/styles/builder/print.css`,
    // all of it inside `@media print`), which whites the token out for paper;
    // theme.css / tokens.ts still DEFINE it and are exempt below like every
    // other definition rule.
    fix: 'Use the workshop ground: `color.wkBg` / `var(--color-wk-bg)` for the step off paper, or `color.paper` / `var(--color-paper)` for the surface itself.',
    pattern: /--color-wk-bg-2(?![\w-])|(?<![\w-])[a-z]+(?:-[trblxy])?-wk-bg-2(?![\w-])|\bwkBg2\b/g,
  },
]

/**
 * Sanctioned literals. Each entry needs a reason — an exemption without a
 * justification is just a silent hole in the guardrail.
 */
const EXEMPTIONS: Exemption[] = [
  {
    file: 'apps/web/src/styles/theme.css',
    rules: ['raw-color', 'rust-allowlist', 'cool-ground'],
    reason:
      'The token definitions themselves — this file is where colour is allowed to be a literal, and where `--color-rust` is DEFINED (rust-allowlist governs who paints with it, not where it is declared).',
  },
  {
    file: 'apps/web/src/design/tokens.ts',
    rules: ['raw-color', 'cool-ground'],
    reason:
      'The TypeScript mirror of theme.css above: a token-definition file, so it is where colour is allowed to be a literal. Every value is ported verbatim from theme.css — nothing here is a new colour, and `src/design/__tests__/tokens.parity.test.ts` fails if the two ever disagree.',
  },
  {
    file: 'apps/web/src/components/atoms/Button.tsx',
    rules: ['rust-allowlist'],
    reason:
      'THE rust allowlist (ruleset §3.1): rust means "do something", and Button is the thing that does. Every action, the Dashboard cost-pennant button included, is painted here or by buttonVariants.',
  },
  {
    file: 'apps/web/src/components/atoms/buttonVariants.ts',
    rules: ['rust-allowlist'],
    reason:
      "THE rust allowlist (ruleset §3.1): Button's class-string recipe, which links styled as buttons use. Its stylesheet half is `.su-btn--primary` in styles/index.css, whose rust lines carry a `design-tokens-ignore` naming this allowlist (the file is shared, so it cannot be exempted whole).",
  },
  {
    file: 'apps/web/src/components/atoms/InlineRef.tsx',
    rules: ['rust-allowlist'],
    reason:
      'THE rust allowlist (ruleset §3.1): the one Reference exception — an inline link. Its paint lives in the stylesheet half, `.su-inline-ref--link` in styles/index.css, whose rust lines carry a `design-tokens-ignore` naming this allowlist; this entry keeps the component itself sanctioned to name rust.',
  },
  {
    file: 'packages/salvageunion-reference/lib/view/discordCard.ts',
    rules: ['raw-color'],
    reason:
      "Discord's accent stripe takes a `0xRRGGBB` integer, never a CSS token, so the Discord card (the bot's lookup and the SRD's Component Embed) mirrors the tone palette as integers. A token-definition mirror like `design/tokens.ts`: every value is theme.css's, and `discordCard.test.ts` fails if one drifts. Its one departure, ink painting the rules blue on Discord's dark theme, is written in the table's own comment.",
  },
  {
    file: 'apps/discord-bot/src',
    rules: ['rust-allowlist'],
    reason:
      "Not a web surface. The bot's embed accent is rust in lockstep with theme.css (`themeLockstep.test.ts`), and Discord renders it as a container edge, not a button or a link; the matches here are the doc comments that cite `--color-rust` as that lockstep's source. Discord's own palette rules are the bot's (ruleset §3.4), not this allowlist's.",
  },
  {
    file: 'apps/web/src/components/atoms/Slab.tsx',
    rules: ['gradient'],
    reason:
      'Named exemption: the Slab dashed leader (a repeating-linear-gradient) is a deliberate control-panel shape built on ink tokens, kept on purpose.',
  },
  {
    file: 'apps/web/src/components/atoms/userMadeHatch.ts',
    rules: ['gradient'],
    reason:
      'The user-made hatch (ruleset §3.5 and §3.9): a HARD-STOP `repeating-linear-gradient(135deg, …)` — coincident stops on `--color-ink-20` over the band\'s own colour — so it paints rules and never blends. Ruled in the ruleset before it was built ("it joins EXEMPTIONS when it lands"); alone in its file so the exemption covers this one constant.',
  },
  {
    file: 'apps/web/src/components/catalog/catalogColors.ts',
    rules: ['gradient'],
    reason:
      "All three gradients are HARD-STOP patterns, which the gradient rule's own fix text allows ('hard colour stops if you mean a pattern') — the tech-level ramp repeats each --color-tl-N twice at exact boundaries, and the ability-tier / class gradients do the same. No shading, and every stop is a token. A catalog tile stands in for a whole SPREAD of entities (six tech levels, three ability tiers, core→hybrid classes) rather than one hue, which is what the banding says. Not new code: this file lived in apps/web, which the guard does not scan, and only became visible when it moved into the shared library to be shared with the Dashboard's SRD Explorer.",
  },
  {
    file: 'apps/web/src/components/atoms/CatalogTile.tsx',
    rules: ['gradient'],
    reason:
      'Named exemption in ruleset §3.5: the catalog tile ramps (--catalog-bg) carry the tech-level and ability-tier ramps. The ramp is a wayfinding cue, not decoration. The only match is the doc comment explaining WHY the fill must use the `background` shorthand — it names the `linear-gradient()` that `background-color` silently drops. That comment is the reason the bug stays fixed, so it is not reworded to dodge the regex.',
  },
  {
    file: 'apps/web/src/styles/global.css',
    rules: ['gradient', 'raw-color'],
    reason:
      'Ruleset §3.5 THE one-off: the .pilot-panel distressed-metal effect on srd /about is a CSS illustration, ruled a sanctioned one-off. It is the single place smooth shading is allowed, and it is allowed because it is a picture of a rusted plate rather than a UI surface. Not precedent — no second one-off without an explicit ruling. raw-color rides along because it is the SAME illustration: the rust blooms, the steel plate, the rivet heads and the engraved lettering are one picture, and a picture needs more shades than a UI palette has — the rivets alone spend nine greys on lit/worn/green/flush/hole. Tokenising them would add a dozen tokens nothing else could ever reuse. CAVEAT, since a file-level exemption is blunter than the rationale: it also swallows three literals outside the illustration block — the .catalog-item hover box-shadow and .catalog-item__name text-shadow (real shadow debt on an authored surface, still owed a token) and one #fff in the print block. Line-scoping the exemption was considered and rejected as too brittle to survive edits to this file; they are recorded here instead of silently absorbed.',
  },
  {
    file: 'apps/web/src/components/atoms/KofiButton.tsx',
    rules: ['raw-color'],
    reason:
      "EXTERNAL BRAND colour, not ours. #2e66c4 is Ko-fi's blue, darkened: the widget sets its label in white on this fill, and Ko-fi's own #72a4f2 measured 2.5:1 against it where WCAG AA wants 4.5:1 (#2e66c4 gives 5.5:1 at nearly the same hue). The widget is recognisable BECAUSE it is blue, so resolving it to a Salvage Union token would misrepresent someone else's mark. This is the standing rule for third-party marks: a colour we source from an external brand keeps the external hue, and anything sourced to OUR design uses the canonical set.",
  },
  {
    file: 'apps/web/src/styles/builder/print.css',
    rules: ['raw-color', 'cool-ground'],
    reason:
      'PRINT MEDIA. Inside `@media print` the surface is physical paper and the ink is real ink, so #fff / #000 are the correct values rather than the screen palette — warm paper (#fbfaf7) printed as a fill wastes toner and reads grey. theme.css already carves out exactly this exception in its paper note ("the only remaining #ffffff is one scoped exception: the @media print sheet"); this is that exception, in the app that owns the sheet. cool-ground rides along because the print sheet whites `--color-wk-bg-2` out with the other themed grounds, so nothing that still reads it prints a tint.',
  },
  {
    file: 'apps/discord-bot/src/format.ts',
    rules: ['raw-color'],
    reason:
      "Not CSS: the bot renders no stylesheet. Discord's `setAccentColor()` takes a 0xRRGGBB integer, so NEUTRAL_ACCENT and ROLL_COLORS restate `--color-rust` and the `--color-roll-*` ramp in the only form the API accepts; each doc comment cites the token's rgb()/hex it was converted from. There is no token to read instead (the bot does not depend on src/components), and `src/__tests__/themeLockstep.test.ts` reads theme.css and fails if any of these drifts — the lockstep the rule exists to enforce, done by a test rather than a lookup.",
  },
  {
    file: 'apps/discord-bot/src/gameCards.ts',
    rules: ['raw-color'],
    reason:
      "Not CSS, same reason as format.ts above: SHEET_ACCENT is the Discord container accent for pilot / mech / crawler sheets, the `--color-sheet-*` tones (= `--color-pilot` / `--color-mech` / `--color-crawler`) as the 0xRRGGBB integers `setAccentColor()` takes. Values verified equal to theme.css when exempted; unlike format.ts's colours, no test pins them to theme.css yet.",
  },
]

/**
 * Catastrophe floor for SCAN_DIRS, counted AFTER tests and generated files are
 * dropped: ~760 files today. See packages/gates/lib/scanFloor.ts for why this is
 * deliberately far below the real count (~65%).
 */
const SCAN_FLOOR = 500

function scannedFiles(root: string): string[] {
  return listFiles(root, SCAN_DIRS, SCAN_EXTENSIONS).filter(
    (rel) =>
      // Generated files and test fixtures are not authored surfaces. Tests are a
      // category rather than an EXEMPTIONS entry: a colour literal in a test is
      // an ASSERTION about behaviour (an arbitrary override passing through
      // untouched), and tokenising it would delete the test.
      !rel.includes('.gen.') &&
      !rel.includes('routeTree') &&
      !rel.includes('__tests__') &&
      !/\.test\.[tj]sx?$/.test(rel)
  )
}

/** Findings per rule for the given sources, keyed by repo-relative path. */
export function scanTokenSources(sources: ReadonlyMap<string, string>): Record<string, Finding[]> {
  const out: Record<string, Finding[]> = {}
  for (const rule of TOKEN_RULES) out[rule.id] = []
  for (const [rel, text] of sources) {
    const lines = text.split('\n')
    for (const rule of TOKEN_RULES) {
      if (isExempt(EXEMPTIONS, rel, rule.id)) continue
      if (rule.skip?.some((s) => rel.includes(s))) continue
      lines.forEach((line, i) => {
        // A line may opt out with a cited reason.
        if (line.includes('design-tokens-ignore')) return
        for (const match of line.match(rule.pattern) ?? []) {
          if (rule.keep && !rule.keep(match, line, rel)) continue
          out[rule.id]?.push({ file: rel, line: i + 1, detail: match })
        }
      })
    }
  }
  return out
}

export const designTokens: RuleSet = {
  id: 'tokens',
  label: 'design tokens',
  rules: TOKEN_RULES,
  exemptionsLive: 'packages/gates/rules/designTokens.ts (or a `design-tokens-ignore` line comment)',
  preflight(root) {
    assertScanFloor('design tokens', scannedFiles(root).length, SCAN_FLOOR)
    // A workspace never added to SCAN_DIRS only makes the floor go up, so the
    // floor is blind to it. See packages/gates/lib/workspaceCoverage.ts.
    assertCoversWorkspaces('design tokens', SCAN_DIRS, {
      'packages/gates':
        'the gates themselves: the rule sets quote the literals they forbid, and nothing here renders.',
    })
  },
  scan(root) {
    const sources = new Map<string, string>()
    for (const rel of scannedFiles(root)) sources.set(rel, readFileSync(join(root, rel), 'utf8'))
    return scanTokenSources(sources)
  },
  summary: (root) => `${scannedFiles(root).length} files scanned`,
}
