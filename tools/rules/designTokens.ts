/**
 * Design-token laws — the `tokens` rule set of `tools/check-styling.ts`.
 *
 * Nothing enforced these laws before this rule set. That absence is why the
 * `su-*` shadow token family survived: the drift was never raw hex (which reads
 * as obviously wrong), it was a parallel token family that *looked* sanctioned
 * at every call site.
 *
 * Why this must exist as a build step rather than a review habit: these tokens
 * are Tailwind v4 `@theme` entries, so a deleted token does not fail typecheck —
 * the utility simply stops being generated and the element renders unstyled.
 * There is no compiler backstop for this class of mistake. This rule set is it.
 *
 * Every rule maps to a law in docs/design-system/ruleset.md; the `rule` field
 * cites the section so a failure tells you which law you broke, not just which
 * regex you tripped.
 *
 * ## Zero rules and the two ratchets
 *
 * Nine rules are `zero`: any finding fails. Three of them landed with the brand
 * refresh's tokens (#1251) and hold the Workshop Manual canon the ruleset
 * ratified in #1250: `rust-allowlist` (§3.1), `type-floor` (§4.6) and
 * `texture-placement` (§3.5). Each landed with its backlog fixed, not
 * baselined, so it starts at zero. Two rules still carry a backlog and are
 * `ratchet` rules, counted against `tools/styling-baseline.json`:
 *
 *   - `raw-color` — the Discord bot restates the palette as hex integers
 *     (`format.ts`, `gameCards.ts`, `lookupCard.ts`; `0xb7410e` is
 *     `--color-rust`, three times over).
 *   - `arbitrary-font-size` — `WizShell.tsx` and `LiveSheet.tsx`.
 *
 * An upward rebaseline is sanctioned only when a rule is made STRICTER, so its
 * count rises without anyone having written a new violation.
 * A stricter rule may raise its baseline ONCE, in the commit that tightens it,
 * with `--allow-increase` and the reason written down. Drift may not.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Exemption, Finding, Rule, RuleSet } from '../lib/ruleEngine'
import { isExempt, listFiles } from '../lib/ruleEngine'
import { assertScanFloor } from '../lib/scanFloor'
import { assertCoversWorkspaces } from '../lib/workspaceCoverage'

export const SCAN_DIRS = [
  'packages/component-lib/src',
  'packages/salvageunion-reference/lib',
  // The DATASET, not just the code that reads it (`.json` included): a raw hex
  // in the data would be a second palette, and `entityCardTone.ts` gives a
  // guide's tone precedence over the domain tone. Guides name a theme tone
  // (`guideTone`); scanning this directory is what keeps it that way.
  'packages/salvageunion-reference/data',
  'apps/srd/src',
  'apps/itun/src',
  // An entire APP the guard could not see. It restates the palette as hex ints
  // (see the `0x` arm of raw-color) — 12 of them, tracked in the baseline and
  // burning down.
  'apps/discord-bot/src',
  'apps/su-assets/src',
  'packages/observability/src',
]

// greembeem (a MediaWiki-palette novelty page) ships as a static file under
// apps/srd/public/, which this check does not scan, so it needs no raw-color
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
export const TYPE_FLOOR_PX = 11

/**
 * Where the light speckle may never sit (ruleset §3.5 "Texture"): buttons,
 * fields, the Dashboard and tooltips, by the files that draw them. Paper, the
 * fifth surface, is not a file — it is caught on the line instead (see
 * `PAPER_GROUND`).
 */
const TEXTURE_FORBIDDEN: readonly RegExp[] = [
  // The Dashboard: ITUN's cockpit and its stylesheets.
  /\/dashboard\//,
  /\/Dashboard\w*\.(?:tsx?|css)$/,
  // Buttons: Button, its recipe, and every *Button component.
  /Button\w*\.tsx?$/,
  /\/buttonVariants\.ts$/,
  // Fields: the input primitives.
  /\/chrome\/(?:Field|FieldError|InlineEditField|inputs|Sel|Checkbox|RadioCardGroup|CountStepper)\.tsx$/,
  /\/SearchField\.tsx$/,
  // Tooltips: the tooltip primitive and the entity hovercard.
  /\/ui\/tooltip\.tsx$/,
  /Tooltip\w*\.tsx$/,
]

/** A paper GROUND on the same line — the speckle never sits on paper. */
const PAPER_GROUND =
  /(?<![\w-])bg-paper(?![\w-])|background(?:-color|Color)?\s*:\s*(?:var\(--color-paper\)|color\.paper\b)/

export const TOKEN_RULES: TokenRule[] = [
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
    mode: 'ratchet',
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
    // 4. The `rgb()` arm uses `(?<![a-zA-Z0-9])`, not `\b`: `_` is a WORD
    //    character, so `\b` never fires inside a Tailwind arbitrary value, where
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
    id: 'arbitrary-tracking',
    mode: 'zero',
    rule: 'ruleset §4.2 — the tracking ladder is tokens only',
    // Ruleset §4.2 ratifies the five rungs theme.css ships; there is no open
    // decision.
    fix: 'Use the tracking ladder: `tracking.capsTight` / `var(--tracking-caps-tight)` (0.04em, the canonical label/stamp tracking), then capsSnug / caps / capsWide, and `tracking.eyebrow` (0.22em, brand caption only).',
    pattern: /tracking-\[[^\]]+\]/g,
  },
  {
    id: 'arbitrary-border-width',
    mode: 'zero',
    rule: 'ruleset §4.3 — border weights are tokens, one meaning each',
    fix: 'Use the border-weight ladder: `borderWidth.entity` / `var(--bw-entity)` (3px), rail (2.5px), pill (2px), chrome (1.5px), hairline (1px).',
    // Only widths — `border-[color:var(--x)]` is a colour, covered by raw-color.
    pattern: /border(?:-[trblxy])?-\[\d*\.?\d+px\]/g,
  },
  {
    id: 'arbitrary-radius',
    mode: 'zero',
    rule: 'ruleset §4.4 — the ONE radius vocabulary',
    // The gap this closes: theme.css has said "never `rounded-[Npx]`" since the
    // radius ladder landed, and nothing enforced it. 28 arbitrary radii
    // accumulated, and 24 of them were EXACT ALIASES of a token that already
    // existed — the drift was never a designer wanting a new value, it was the
    // ladder being invisible at the call site. Same shape as the three
    // arbitrary-* rules above, and it belongs beside them.
    fix: 'Use the radius ladder: `radius.pip` / `var(--radius-pip)` (1px, tracker pips), badge (2px, the stamp-chip family), card (3px — cards, inputs, buttons), panel (6px — app-chrome panels & pick cards). Stamps are square: `radius.none`. Pick by ROLE, not by which number is nearest.',
    // Corner/side modifiers included (rounded-t-, rounded-tl-, rounded-ss-).
    // Only px literals — `rounded-[var(--x)]` is indirection, not a new rung.
    pattern: /\brounded(?:-[a-z]{1,2})?-\[\d*\.?\d+px\]/g,
  },
  {
    id: 'arbitrary-font-size',
    mode: 'ratchet',
    rule: 'ruleset §4.2 — one type scale',
    fix: 'Use the semantic type ladder: `fontSize.badge` / `var(--text-badge)` (11px, the floor), then note / caption / lede, and the display end — readout (17) / title (22) / display (26) / displayLg (31) / hero (38).',
    pattern: /text-\[(?!var\(|color:|--)[^\]]+\]/g,
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
    // SVG `fontSize`). `arbitrary-font-size` above still counts every
    // arbitrary utility; this one fails the build on the small ones.
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
    // property (rust, rust-hi, rust-25), a Tailwind utility under any variant
    // prefix, and the `color.rust*` token keys.
    fix: 'Rust is painted only by `Button` / `buttonVariants` (every action) and `InlineRef` (an inline link). A link in prose is `InlineRef` or `inlineLinkClass`; a heading or a "here" state is ink (an ink Slab, an inverse stamp); a focus or selection ring is ink. Never alias a token to rust.',
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
    id: 'pure-white',
    mode: 'zero',
    rule: 'ruleset §4.1 — pure white is retired; paper (#fbfaf7) is the one light surface',
    fix: 'Use paper: `color.paper` / `var(--color-paper)`.',
    pattern: /\b(?:bg|text|border|ring|fill|stroke)-white\b/g,
  },
]

/**
 * Sanctioned literals. Each entry needs a reason — an exemption without a
 * justification is just a silent hole in the guardrail.
 */
const EXEMPTIONS: Exemption[] = [
  {
    file: 'packages/component-lib/src/styles/theme.css',
    rules: ['raw-color', 'arbitrary-border-width', 'arbitrary-radius', 'rust-allowlist'],
    reason:
      'The token definitions themselves — this file is where colour is allowed to be a literal, and where `--color-rust` is DEFINED (rust-allowlist governs who paints with it, not where it is declared). arbitrary-border-width and arbitrary-radius are exempt for a different reason: the file authors no borders and no radii at all, it DEFINES the --bw-* and --radius-* ladders. Their only matches are the prose in each ladder doc-comment ("never `border-[1.5px]`", "never rounded-[Npx]") — the rule text quoting the form it forbids. Rewording those comments to dodge the regex would make the canon harder to read to satisfy a lint.',
  },
  {
    file: 'packages/component-lib/src/design/tokens.ts',
    rules: ['raw-color', 'rust-allowlist'],
    reason:
      'The TypeScript mirror of theme.css above: a token-definition file, so it is where colour is allowed to be a literal. Every value is ported verbatim from theme.css — nothing here is a new colour, and `src/design/tokens.parity.test.ts` fails if the two ever disagree. The exemption is scoped to `raw-color` alone: an arbitrary radius, tracking or border width written here would still be a violation, because those ladders are token NAMES rather than literals even inside the file that defines them.',
  },
  {
    file: 'packages/component-lib/src/components/chrome/Button.tsx',
    rules: ['rust-allowlist'],
    reason:
      'THE rust allowlist (ruleset §3.1): rust means "do something", and Button is the thing that does. Every action, the Dashboard cost-pennant button included, is painted here or by buttonVariants.',
  },
  {
    file: 'packages/component-lib/src/components/chrome/buttonVariants.ts',
    rules: ['rust-allowlist'],
    reason:
      "THE rust allowlist (ruleset §3.1): Button's class-string recipe, which links styled as buttons use. Its stylesheet half is `.su-btn--primary` in styles/index.css, whose rust lines carry a `design-tokens-ignore` naming this allowlist (the file is shared, so it cannot be exempted whole).",
  },
  {
    file: 'packages/component-lib/src/components/chrome/InlineRef.tsx',
    rules: ['rust-allowlist'],
    reason:
      'THE rust allowlist (ruleset §3.1): the one Reference exception — an inline link. `inlineLinkClass` here is the same treatment for a plain prose link, so a link anywhere in either app reads as InlineRef does.',
  },
  {
    file: 'apps/discord-bot/src',
    rules: ['rust-allowlist'],
    reason:
      "Not a web surface. The bot's embed accent is rust in lockstep with theme.css (`themeLockstep.test.ts`), and Discord renders it as a container edge, not a button or a link; the matches here are the doc comments that cite `--color-rust` as that lockstep's source. Discord's own palette rules are the bot's (ruleset §3.4), not this allowlist's.",
  },
  {
    file: 'packages/component-lib/src/components/chrome/Slab.tsx',
    rules: ['gradient'],
    reason:
      'Named exemption: the Slab dashed leader (a repeating-linear-gradient) is a deliberate control-panel shape built on ink tokens, kept on purpose.',
  },
  {
    file: 'packages/component-lib/src/catalog/catalogColors.ts',
    rules: ['gradient'],
    reason:
      "All three gradients are HARD-STOP patterns, which the gradient rule's own fix text allows ('hard colour stops if you mean a pattern') — the tech-level ramp repeats each --color-tl-N twice at exact boundaries, and the ability-tier / class gradients do the same. No shading, and every stop is a token. A catalog tile stands in for a whole SPREAD of entities (six tech levels, three ability tiers, core→hybrid classes) rather than one hue, which is what the banding says. Not new code: this file lived in apps/srd, which the guard does not scan, and only became visible when it moved into component-lib to be shared with the Dashboard's SRD Explorer.",
  },
  {
    file: 'packages/component-lib/src/stories',
    rules: [
      'rust-allowlist',
      'raw-color',
      'arbitrary-font-size',
      'arbitrary-tracking',
      'arbitrary-border-width',
      'pure-white',
      'gradient',
    ],
    reason:
      'Foundations catalog pages render token specimens and deliberately show off-system values as counter-examples. rust-allowlist is on the list because Foundations/Theme specimens the rust swatch itself — a token page that could not show the action colour would be missing a token. arbitrary-border-width is on the list for exactly that reason: the sole match is Theme.stories.tsx printing the border ladder\'s own caption, "never border-[1.5px]" — the counter-example is the content. (This entry is the directory, so it also covers the non-story helper here, _harness.tsx.)',
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
      'Stories are specimens, not shipped surfaces — the same standing the Foundations catalog pages above already have, extended to the co-located ones so the rule does not depend on which directory a story happens to live in. Their literals are harness scaffolding: the --tone/--ground custom properties the consuming APP supplies at runtime (ModeDoor, VitalGauge), a dark backdrop to prove contrast against, a #ccc outline on a resize container (DashboardGrid/DashboardCanvas), and swatch props fed as data (FilterChip). Nothing here reaches a user, and tokenising a stand-in for app-supplied context would make the story demonstrate something other than what ships. Note the cost, since it is real: stories are where new surfaces get prototyped, so this is the one place drift can incubate un-flagged — a literal that graduates from a story into a component is caught at the component, not here. `gradient` is deliberately NOT on this list: a gradient is banned by §3.5 on shading grounds that a specimen does not escape, and the one sanctioned story gradient (CatalogTile.stories.tsx) is named individually below.',
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
    file: 'apps/srd/src/styles/global.css',
    rules: ['gradient', 'raw-color'],
    reason:
      'Ruleset §3.5 THE one-off: the .pilot-panel distressed-metal effect on srd /about is a CSS illustration, ruled a sanctioned one-off. It is the single place smooth shading is allowed, and it is allowed because it is a picture of a rusted plate rather than a UI surface. Not precedent — no second one-off without an explicit ruling. raw-color rides along because it is the SAME illustration: the rust blooms, the steel plate, the rivet heads and the engraved lettering are one picture, and a picture needs more shades than a UI palette has — the rivets alone spend nine greys on lit/worn/green/flush/hole. Tokenising them would add a dozen tokens nothing else could ever reuse. CAVEAT, since a file-level exemption is blunter than the rationale: it also swallows three literals outside the illustration block — the .catalog-item hover box-shadow and .catalog-item__name text-shadow (real shadow debt on an authored surface, still owed a token) and one #fff in the print block. Line-scoping the exemption was considered and rejected as too brittle to survive edits to this file; they are recorded here instead of silently absorbed.',
  },
  {
    file: 'apps/itun/src/components/wizard/WizShell.tsx',
    rules: ['arbitrary-border-width'],
    reason:
      "Not a border WEIGHT — a shape. The two matches (`border-x-[9px]`, `border-t-[14px]`) sit on an `h-0 w-0` span with `border-x-transparent`: the CSS-triangle idiom, drawing the caret under the wizard step marker. Those numbers are the triangle's half-width and height, so snapping them to the 1.5/2/2.5/3px weight ladder would not tidy a border, it would resize a glyph. The rule is right to look here and wrong about this one.",
  },
  {
    file: 'packages/component-lib/src/components/shared/KofiButton.tsx',
    rules: ['raw-color'],
    reason:
      "EXTERNAL BRAND colour, not ours. #2e66c4 is Ko-fi's blue, darkened: the widget sets its label in white on this fill, and Ko-fi's own #72a4f2 measured 2.5:1 against it where WCAG AA wants 4.5:1 (#2e66c4 gives 5.5:1 at nearly the same hue). The widget is recognisable BECAUSE it is blue, so resolving it to a Salvage Union token would misrepresent someone else's mark. This is the standing rule for third-party marks: a colour we source from an external brand keeps the external hue, and anything sourced to OUR design uses the canonical set. Note the prop is caller-overridable, so a consumer that wants a themed button already can.",
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
]

/**
 * Catastrophe floor for SCAN_DIRS, counted AFTER tests and generated files are
 * dropped: ~760 files today. See tools/lib/scanFloor.ts for why this is
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
  exemptionsLive: 'tools/rules/designTokens.ts (or a `design-tokens-ignore` line comment)',
  preflight(root) {
    assertScanFloor('design tokens', scannedFiles(root).length, SCAN_FLOOR)
    // A workspace never added to SCAN_DIRS only makes the floor go up, so the
    // floor is blind to it. See tools/lib/workspaceCoverage.ts.
    assertCoversWorkspaces('design tokens', SCAN_DIRS)
  },
  scan(root) {
    const sources = new Map<string, string>()
    for (const rel of scannedFiles(root)) sources.set(rel, readFileSync(join(root, rel), 'utf8'))
    return scanTokenSources(sources)
  },
  summary: (root) => `${scannedFiles(root).length} files scanned`,
}
