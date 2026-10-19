/**
 * Chrome laws — the `chrome` rule set of `tools/check-rule-sets.ts`, the
 * machine-checkable laws of `docs/design-system/chrome.md`.
 *
 * ## One ground signal (hard rule R19, chrome K1)
 *
 * A surface declares its ground once, `data-ground="paper" | "ink"` on its
 * frame, as `data-grain` declares its texture, and every component inside
 * reads it in CSS (`[data-ground='ink'] .su-…`). Before this there were six
 * spellings of "on ink": a `ground` prop (Segmented, StepButton, Message), an
 * `onInk` prop (Chips, CardLabels, CostBox, ActivationCost, a Token's cells),
 * Stat's `inverse`, Badge's `on-ink` plate chosen by ground, Button's
 * `surface="ink"`, and the bar's own faded foregrounds. Each one had to be
 * threaded from the frame to the leaf by hand, and a leaf that missed it
 * printed ink on ink with nothing failing.
 *
 * - `ground-signal`: no ground prop at all (`onInk`, `onPaper`, `ground`, an
 *   ink `surface`, Stat's `inverse`), and `data-ground` only on a frame
 *   (`FRAMES`).
 * - `paper-mix`: paper on ink is `--color-paper-NN` alone, never a
 *   `color-mix()` fading paper into transparent (a second, unlisted palette).
 *
 * ## One focus ring (hard rule R28, chrome K9)
 *
 * Every focusable thing shows `--focus-ring-shadow` on `:focus-visible`, in
 * ink, Play included. Six variants grew beside it (an offset outline, a
 * colour change, an underline, a dashed outline, a darker border, a paper
 * outline), each a keyboard user had to learn again.
 *
 * - `focus-ring`: a rule whose subject is focused (`:focus-visible`,
 *   `:focus-within`, or `:has()` of one) sets only the ring: `box-shadow:
 *   var(--focus-ring-shadow)` and the forced-colors `outline: 3px solid
 *   transparent`. A plain `:focus` rule may move or size its element (the skip
 *   link, a search field's width) but paints no indicator of its own. A
 *   focused element's sibling (`:focus ~ label`) is not its indicator.
 *
 * ## Three dialog widths (hard rule R24, chrome K7)
 *
 * `ModalShell` is narrow (28rem), default (48rem) or page (72rem), chosen by
 * its `width` prop, which takes only those three (the type system holds
 * that). Before, it took a class for its cap, and 25 dialogs grew ten widths.
 *
 * - `dialog-width`: no stylesheet rule whose subject is a dialog (a class
 *   naming a `dialog`, `modal` or `popup`, or `[role=dialog]`) sets a
 *   `max-width` / `max-inline-size`.
 *
 * ## A notice has one job (hard rule R20, chrome K5)
 *
 * A toast reports an act, from the one toaster per document; a `Banner` holds
 * a lasting condition, and offline is one notice in one wording; no notice
 * wears a roll-tier colour (ruleset §3.4).
 *
 * - `one-toaster`: exactly one `<Toaster` element in the app's source, the
 *   one `ToasterMount` draws (tests may render their own).
 * - `offline-copy`: the offline wording ("not connected", "read-only until
 *   the connection returns") only in `NotConnectedBanner`.
 * - `roll-tier`: no roll-tier token (`rollFailure`, `--color-roll-*`, …)
 *   anywhere in the app: the tiers are the Discord bot's (`DISCORD_ROLL_ACCENT`).
 *
 *
 * ## One component per chrome role (hard rule R16, chrome Roles)
 *
 * A wizard is `WizShell`, a field `Input` / `Textarea` under `Field`'s one
 * label, a trail `BreadcrumbTrail`. Before it the NPC designer was a second
 * wizard, three hand-rolled inputs typed at 11–12px (which zooms an iPhone),
 * five places hand-built a trail, and a field's label was drawn four ways.
 *
 * - `raw-field`: a JSX `<input>` or `<textarea>` only in an atom
 *   (`components/atoms/`); a hidden file picker (`type="file"`) is no field.
 * - `raw-label`: a JSX `<label>` only in an atom (`Field`, `Eyebrow`,
 *   `Checkbox`'s hit area, `Radio`'s row).
 * - `breadcrumb-nav`: `aria-label="Breadcrumb"` only in `BreadcrumbTrail`,
 *   which owns its nav.
 * - `step-current`: `aria-current="step"` only in `WizShell`.
 *
 * ## Stats render through Stat (hard rule R36, ruleset §3.7)
 *
 * Every `label | value` is a `Stat`, never hand-assembled text.
 *
 * - `stat-text`: JSX text of a stat label right before an expression
 *   (`SP {n}`, `HP: {hp}`) anywhere but `Stat`.
 *
 * Every rule is `zero`. Comments are stripped, so prose may name what it bans.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Finding, Rule, RuleSet } from '../lib/ruleEngine'
import { listFiles } from '../lib/ruleEngine'
import { assertScanFloor } from '../lib/scanFloor'

const SRC = 'apps/web/src'

/**
 * The frames: the components that declare a ground. Every other component
 * reads it. A new frame is added here, with the surface it is.
 */
const FRAMES: Record<string, string> = {
  'apps/web/src/components/atoms/ChapterBand.tsx': 'a page band (ink when it prints paper)',
  'apps/web/src/components/entity/parts/Head.tsx': "an entity form's head band (the ink banner)",
  'apps/web/src/components/referenceEntity/card/EntityCardHeader.tsx': "a card's head band",
  'apps/web/src/components/entity/forms/Token.tsx': "a Token's pill",
  'apps/web/src/build/wizard/WizShell.tsx': "a wizard's ink action pill",
  'apps/web/src/components/containers/ModalShell.tsx':
    "a dialog band's control slot (ink when the band prints paper: the danger rust)",
}

const isTest = (rel: string) => rel.includes('/__tests__/') || /\.test\.tsx?$/.test(rel)

/** Blank comments, keeping line numbers, so prose never reads as a use. */
function stripComments(text: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ')
  return text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|\s)\/\/[^\n]*/g, (m, lead) => {
    return lead + blank(m.slice(lead.length))
  })
}

/** Each banned ground prop, by its spellings (a JSX attribute or a prop type). */
const GROUND_PROPS: { pattern: RegExp; what: string }[] = [
  { pattern: /\bonInk\b/, what: 'an `onInk` prop' },
  {
    pattern: /(?<![\w-])onPaper(?:\??:\s*boolean|=\{|(?=\s*\/?>))/,
    what: 'an `onPaper` prop (the ground, read off the frame inverted)',
  },
  { pattern: /(?<![\w-])ground=["'{]/, what: 'a `ground` prop' },
  { pattern: /(?<![\w-])ground\??:\s*'(?:paper|ink)'/, what: 'a `ground` prop type' },
  {
    pattern: /\bsurface(?:=\{?|\??:\s*)["'](?:on-)?ink["']/,
    what: 'an ink `surface` (the ground as a plate)',
  },
  { pattern: /["']on-ink["']/, what: "an `'on-ink'` value" },
  { pattern: /\binverse=\{/, what: "Stat's `inverse` (the ground as a prop)" },
]

function scanGroundSignal(root: string): Finding[] {
  const out: Finding[] = []
  for (const rel of listFiles(root, [SRC], ['.ts', '.tsx'])) {
    if (isTest(rel)) continue
    const lines = stripComments(readFileSync(join(root, rel), 'utf8')).split('\n')
    lines.forEach((text, i) => {
      for (const { pattern, what } of GROUND_PROPS) {
        if (pattern.test(text)) {
          out.push({ file: rel, line: i + 1, detail: `${what}: ${text.trim()}` })
        }
      }
      if (/\bdata-ground\b/.test(text) && !(rel in FRAMES)) {
        out.push({
          file: rel,
          line: i + 1,
          detail: `\`data-ground\` outside a frame: ${text.trim()}`,
        })
      }
    })
  }
  return out
}

/** A `color-mix()` that fades paper into transparent, by any spelling of paper. */
const PAPER_MIX =
  /color-mix\([^\n]*(?:--color-paper\)|color\.paper\b|\bpaper\b)[^\n]*\btransparent\b|color-mix\([^\n]*\btransparent\b[^\n]*(?:--color-paper\)|color\.paper\b)/

function scanPaperMix(root: string): Finding[] {
  const out: Finding[] = []
  for (const rel of listFiles(root, [SRC], ['.css', '.ts', '.tsx'])) {
    if (isTest(rel)) continue
    stripComments(readFileSync(join(root, rel), 'utf8'))
      .split('\n')
      .forEach((text, i) => {
        if (PAPER_MIX.test(text)) out.push({ file: rel, line: i + 1, detail: text.trim() })
      })
  }
  return out
}

/** The two declarations a focus rule may make. */
const RING = new Set(['box-shadow: var(--focus-ring-shadow)', 'outline: 3px solid transparent'])
/** What paints an indicator: a plain `:focus` rule may set none of these but the ring. */
const INDICATOR =
  /^(?:color|background|border|outline|text-decoration|text-underline|box-shadow|fill|stroke)/

/** Split at depth-0 occurrences of `sep` (a comma, or a combinator), never inside `()` or `[]`. */
function splitTop(text: string, sep: RegExp): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? ''
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    else if (depth === 0 && sep.test(ch)) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts.map((p) => p.trim()).filter(Boolean)
}

/** The focus state a selector's subject (its last compound) is in, if any. */
function subjectFocus(selector: string): 'visible' | 'focus' | null {
  const subject = splitTop(selector, /[\s>+~]/).at(-1) ?? ''
  if (/:focus-(?:visible|within)\b/.test(subject)) return 'visible'
  if (/:focus\b(?!-)/.test(subject)) return 'focus'
  return null
}

function scanFocusRing(root: string): Finding[] {
  const out: Finding[] = []
  for (const rel of listFiles(root, [SRC], ['.css'])) {
    const css = stripComments(readFileSync(join(root, rel), 'utf8'))
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectorText = (m[1] ?? '').trim()
      if (selectorText.startsWith('@')) continue
      const states = splitTop(selectorText, /,/).map(subjectFocus)
      if (!states.some(Boolean)) continue
      const strict = states.includes('visible')
      // The selector's own line, past the whitespace the match starts with.
      const lead = (m[1] ?? '').length - (m[1] ?? '').trimStart().length
      const line = css.slice(0, (m.index ?? 0) + lead).split('\n').length
      for (const raw of (m[2] ?? '').split(';')) {
        const decl = raw.trim().replace(/\s+/g, ' ')
        if (!decl || RING.has(decl)) continue
        if (strict || INDICATOR.test(decl)) {
          out.push({
            file: rel,
            line,
            detail: `${selectorText.replace(/\s+/g, ' ')} { ${decl} }`,
          })
        }
      }
    }
  }
  return out
}

/**
 * A selector's subject that is a dialog: a dialog, modal or popup class (a
 * modifier included, never one of its parts, `__body`), or the role.
 */
const DIALOG_SUBJECT =
  /\.su-[\w-]*?(?:dialog|modal|popup)(?:--[\w-]+)?(?![\w-])|\[role=['"]?(?:alert)?dialog['"]?\]/
const WIDTH_CAP = /^(?:max-width|max-inline-size)\s*:/

function scanDialogWidth(root: string): Finding[] {
  const out: Finding[] = []
  for (const rel of listFiles(root, [SRC], ['.css'])) {
    const css = stripComments(readFileSync(join(root, rel), 'utf8'))
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectorText = (m[1] ?? '').trim()
      if (selectorText.startsWith('@')) continue
      const dialog = splitTop(selectorText, /,/).some((sel) =>
        DIALOG_SUBJECT.test(splitTop(sel, /[\s>+~]/).at(-1) ?? '')
      )
      if (!dialog) continue
      const lead = (m[1] ?? '').length - (m[1] ?? '').trimStart().length
      const line = css.slice(0, (m.index ?? 0) + lead).split('\n').length
      for (const raw of (m[2] ?? '').split(';')) {
        const decl = raw.trim().replace(/\s+/g, ' ')
        if (WIDTH_CAP.test(decl)) {
          out.push({ file: rel, line, detail: `${selectorText.replace(/\s+/g, ' ')} { ${decl} }` })
        }
      }
    }
  }
  return out
}

/** Each line of the app's source (comments blanked) that `pattern` matches. */
function scanLines(
  root: string,
  exts: string[],
  pattern: RegExp,
  skip: (rel: string) => boolean
): Finding[] {
  const out: Finding[] = []
  for (const rel of listFiles(root, [SRC], exts)) {
    if (skip(rel)) continue
    stripComments(readFileSync(join(root, rel), 'utf8'))
      .split('\n')
      .forEach((text, i) => {
        if (pattern.test(text)) out.push({ file: rel, line: i + 1, detail: text.trim() })
      })
  }
  return out
}

/** The one place the toaster is drawn. */
const TOASTER_HOME = 'apps/web/src/components/containers/Toaster.tsx'

function scanOneToaster(root: string): Finding[] {
  const found = scanLines(root, ['.tsx'], /<Toaster\b/, isTest)
  if (found.length === 1 && found[0]?.file === TOASTER_HOME) return []
  if (found.length === 0) {
    return [
      { file: TOASTER_HOME, line: 1, detail: 'no `<Toaster` element: toasts have nowhere to show' },
    ]
  }
  return found.filter((f) => f.file !== TOASTER_HOME || found.length > 1)
}

/** The one offline notice. */
const OFFLINE_HOME = 'apps/web/src/components/shared/NotConnectedBanner.tsx'
const OFFLINE_COPY = /\bnot connected\b|read-only until the connection returns/i

function scanOfflineCopy(root: string): Finding[] {
  return scanLines(
    root,
    ['.ts', '.tsx'],
    OFFLINE_COPY,
    (rel) => isTest(rel) || rel === OFFLINE_HOME
  )
}

/** The Discord bot's roll tiers, by either spelling. */
const ROLL_TIER = /\broll(?:Cascade|Failure|Tough|Success|Nailed)\b|--color-roll-/

function scanRollTier(root: string): Finding[] {
  return scanLines(root, ['.ts', '.tsx', '.css'], ROLL_TIER, () => false)
}

/** The atoms: the one home of a raw field or label (R16). */
const ATOMS = 'apps/web/src/components/atoms/'

/** The one component each chrome role's markup may appear in (R16). */
const ROLE_HOMES = {
  breadcrumb: 'apps/web/src/components/atoms/BreadcrumbTrail.tsx',
  step: 'apps/web/src/build/wizard/WizShell.tsx',
} as const

/** A JSX field element, to its self-closing end (`=>` in a handler holds no `/>`). */
const RAW_FIELD = /<(input|textarea)(?=[\s/>])[\s\S]*?\/>/g
const RAW_LABEL = /<label(?=[\s>])/
const BREADCRUMB_NAV = /aria-label=(?:\{\s*)?["'`]Breadcrumb["'`]/
const STEP_CURRENT = /aria-current=(?:["']step["']|\{[^}\n]*["']step["'])/

function lineAt(text: string, index: number): number {
  return text.slice(0, index).split('\n').length
}

/** Every `.tsx` source but the tests, comments blanked. */
function jsxSources(root: string): [string, string][] {
  return listFiles(root, [SRC], ['.tsx'])
    .filter((rel) => !isTest(rel))
    .map((rel) => [rel, stripComments(readFileSync(join(root, rel), 'utf8'))])
}

function scanRawFields(root: string): Finding[] {
  const out: Finding[] = []
  for (const [rel, text] of jsxSources(root)) {
    if (rel.startsWith(ATOMS)) continue
    for (const m of text.matchAll(RAW_FIELD)) {
      if (/\btype=["']file["']/.test(m[0])) continue
      const line = lineAt(text, m.index ?? 0)
      out.push({
        file: rel,
        line,
        detail: `a raw <${m[1]}>: ${text.split('\n')[line - 1]?.trim()}`,
      })
    }
  }
  return out
}

/** Lines matching `pattern` in `.tsx` sources, but in `home` (or under it). */
function scanOutside(root: string, pattern: RegExp, home: string): Finding[] {
  const out: Finding[] = []
  for (const [rel, text] of jsxSources(root)) {
    if (rel.startsWith(home)) continue
    text.split('\n').forEach((line, i) => {
      if (pattern.test(line)) out.push({ file: rel, line: i + 1, detail: line.trim() })
    })
  }
  return out
}

/** The one home of a stat's `label | value` (ruleset §3.7). */
const STAT_HOME = 'apps/web/src/components/atoms/Stat.tsx'

/**
 * A stat's label as a reader sees it, short or in full words (`STAT_LABELS`,
 * the sheets' vitals and Tech Level).
 */
const STAT_LABEL =
  'SP|HP|EP|AP|TL|SV|Heat|Slots|Cargo|Upkeep|Structure Points|Hit Points|Energy Points|Ability Points|Heat Capacity|Salvage Value|Tech Level'

/**
 * JSX text naming a stat right before an expression (`SP {n}`, `HP: {hp}`,
 * `SP: <strong>{n}`):
 * a hand-built reading. Not a template literal's `${…}`, a string, or an
 * object key (`SP: {`).
 */
const STAT_TEXT = new RegExp(
  `(?<![\\w$.'"\`-])(?:${STAT_LABEL})(?![\\w-])(?:\\s*:)?(?:\\s*<[a-z]+>)?\\s*\\{`,
  'g'
)

/** Each hand-built stat reading in one `.tsx` source (comments blanked). */
export function statTextFindings(rel: string, text: string): Finding[] {
  if (rel === STAT_HOME) return []
  const out: Finding[] = []
  text.split('\n').forEach((line, i) => {
    if (/^\s*(?:\w+|'[^']*'|"[^"]*")\s*:\s*\{/.test(line)) return
    for (const m of line.matchAll(STAT_TEXT)) {
      out.push({ file: rel, line: i + 1, detail: `${m[0].trim()}: ${line.trim()}` })
    }
  })
  return out
}

type ChromeRule = Rule & { scan: (root: string) => Finding[] }

const RULES: ChromeRule[] = [
  {
    id: 'ground-signal',
    mode: 'zero',
    rule: 'hard rule R19 (chrome K1) — a surface declares its ground once, `data-ground` on its frame; components read it in CSS, never through a prop',
    fix: "Drop the prop: style the component for paper, and add its ink look as `[data-ground='ink'] .su-…` in its stylesheet. A new frame (a band, plate or pill that IS a ground) sets `data-ground` and joins FRAMES in packages/gates/rules/chrome.ts.",
    scan: scanGroundSignal,
  },
  {
    id: 'paper-mix',
    mode: 'zero',
    rule: 'hard rule R19 (chrome K1) — paper on ink is `--color-paper-NN` alone, never a `color-mix()` of paper',
    fix: 'Use the paper step: `var(--color-paper-85|70|60|30|15)` in CSS, `color.paper85|70|60|30|15` in a style object.',
    scan: scanPaperMix,
  },
  {
    id: 'focus-ring',
    mode: 'zero',
    rule: 'hard rule R28 (chrome K9) — one focus ring: a focused rule sets only `--focus-ring-shadow` (and the forced-colors transparent outline)',
    fix: 'Give the element `FOCUS_RING` (`su-focus-ring`), or make the rule `outline: 3px solid transparent; box-shadow: var(--focus-ring-shadow)` and nothing else; move a hover colour, underline or border to a `:hover` rule of its own. A clipped element draws the ring on its frame with `:has(… :focus-visible)`.',
    scan: scanFocusRing,
  },
  {
    id: 'dialog-width',
    mode: 'zero',
    rule: "hard rule R24 (chrome K7) — a dialog is narrow, default or page, from `ModalShell`'s `width`; no stylesheet caps a dialog",
    fix: 'Delete the cap and pass `ModalShell` `width="narrow"` (a confirm, a short prompt, a picker of one thing), `"default"` (the rest) or `"page"` (the detail Page, or a searcher that shows one).',
    scan: scanDialogWidth,
  },
  {
    id: 'one-toaster',
    mode: 'zero',
    rule: 'hard rule R20 (chrome K5) — one toaster per document: the one `<Toaster` is the one `ToasterMount` draws',
    fix: "Render `<ToasterMount />` where a surface needs toasts (the app root, an SRD island that toasts); it shares the document's one toaster. Never render `<Toaster` outside components/containers/Toaster.tsx.",
    scan: scanOneToaster,
  },
  {
    id: 'offline-copy',
    mode: 'zero',
    rule: 'hard rule R20 (chrome K5) — offline is one notice in one wording, `NotConnectedBanner`',
    fix: 'Say the consequence here ("Read-only for now", "That change was not saved") and leave the condition to `NotConnectedBanner`, which is up whenever the app is offline.',
    scan: scanOfflineCopy,
  },
  {
    id: 'roll-tier',
    mode: 'zero',
    rule: "hard rule R20 (ruleset §3.4, chrome K5) — the roll tiers are the Discord bot's; no web surface or notice wears one",
    fix: 'A state is `statusOk` / `statusWarn` / `statusBad` (`--color-status-*`); a roll result is the readout and the row mark, the same for every outcome; a notice is in ink. The bot reads `DISCORD_ROLL_ACCENT`.',
    scan: scanRollTier,
  },
  {
    id: 'raw-field',
    mode: 'zero',
    rule: 'hard rule R16 (chrome Roles) — a field is `Input` or `Textarea` (16px, so an iPhone never zooms), never a raw <input> or <textarea> outside the atoms',
    fix: 'Render `Input` (`size="compact"` beside Compact buttons) or `Textarea` from components/index, labelled by `Field` or an `aria-label`; a check is `Checkbox`, a choice `Radio`, a search `SearchField`.',
    scan: scanRawFields,
  },
  {
    id: 'raw-label',
    mode: 'zero',
    rule: "hard rule R16 (chrome Roles) — a field's label is `Field`'s one treatment, never a hand-rolled <label>",
    fix: 'Wrap the control in `Field label="…" htmlFor={id}`; a lone check takes `Checkbox hitArea` for its 44px square.',
    scan: (root) => scanOutside(root, RAW_LABEL, ATOMS),
  },
  {
    id: 'breadcrumb-nav',
    mode: 'zero',
    rule: 'hard rule R16 (chrome Roles) — a trail is `BreadcrumbTrail`, which owns its `nav aria-label="Breadcrumb"`',
    fix: 'Render `BreadcrumbTrail breadcrumbs={…} placement="bar|row|band"` (`link={AppLink}` in the app); on a page band, provide it through `ChapterBandTrail`.',
    scan: (root) => scanOutside(root, BREADCRUMB_NAV, ROLE_HOMES.breadcrumb),
  },
  {
    id: 'step-current',
    mode: 'zero',
    rule: 'hard rule R16 (chrome Roles) — a stepper is `WizShell`, the one `aria-current="step"`',
    fix: "Draw the steps with `WizShell` (its `band={false}` under a page's own band), driven by `useWizardFlow`'s `shell`.",
    scan: (root) => scanOutside(root, STEP_CURRENT, ROLE_HOMES.step),
  },
  {
    id: 'stat-text',
    mode: 'zero',
    rule: 'hard rule R36 (ruleset §3.7) — every `label | value` is a `Stat`, never JSX text such as `SP {n}`',
    fix: 'Render `<Stat label="SP" value={n} />` (with `max` for a reading out of a maximum, `size` for the line); in a sentence, say it in words around the number ("4 Hit Points"), never as a label and a value.',
    scan: (root) => jsxSources(root).flatMap(([rel, text]) => statTextFindings(rel, text)),
  },
]

export const chromeLaws: RuleSet = {
  id: 'chrome',
  label: 'chrome laws',
  rules: RULES,
  exemptionsLive: 'packages/gates/rules/chrome.ts (FRAMES, ATOMS, ROLE_HOMES)',
  preflight(root) {
    // A catastrophe floor far below today's ~1,000 source files and ~60 stylesheets.
    assertScanFloor('chrome (app source)', listFiles(root, [SRC], ['.ts', '.tsx']).length, 350)
    assertScanFloor('chrome (app CSS)', listFiles(root, [SRC], ['.css']).length, 10)
  },
  scan(root) {
    const out: Record<string, Finding[]> = {}
    for (const rule of RULES) out[rule.id] = rule.scan(root)
    return out
  },
}
