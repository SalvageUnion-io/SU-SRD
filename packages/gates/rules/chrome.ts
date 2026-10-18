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
 * - `ground-signal`: no ground prop at all (`onInk`, `ground`, an ink
 *   `surface`, Stat's `inverse`), and `data-ground` only on a frame (`FRAMES`).
 * - `paper-mix`: paper on ink is `--color-paper-NN` alone, never a
 *   `color-mix()` fading paper into transparent (a second, unlisted palette).
 *
 * Both are `zero`. Comments are stripped, so prose may name what it bans.
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
]

export const chromeLaws: RuleSet = {
  id: 'chrome',
  label: 'chrome laws',
  rules: RULES,
  exemptionsLive: 'packages/gates/rules/chrome.ts (FRAMES)',
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
