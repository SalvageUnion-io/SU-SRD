/**
 * Select mode — the `select-mode` rule set of `tools/check-rule-sets.ts`, hard
 * rule R15 (`docs/design-system/hard-rules.md`, EDL Modes).
 *
 * One select mode in every picker, wizard and searcher: at level 1 a selected
 * Row or Card wears the ink ring and the "Selected" seal; at level 2 the
 * in-card toggle Token wears the ring alone; an option the picker cannot take,
 * demotes or has not chosen wears the one dim (`SELECT_DIM`, the card's
 * `selectable={false}`); a single choice is a radio. Before it a wizard Card
 * showed no seal, the searcher hand-built a "Chosen" plate, a level-2 choice
 * was sealed, and pickers dimmed at 0.7, 0.45, 0.3 and 0.5-and-drained.
 *
 * - `picker-opacity`: a picker file (one that draws a select: `selectionRole`,
 *   a `select` mode, a radio card or group, `Sel`, a checkbox or radio) sets
 *   no `opacity` of its own, in a style object or a utility class; nor does a
 *   stylesheet rule keyed on a pick's state (`[data-selected]`, `[aria-pressed]`,
 *   `:checked`, an unticked or unchosen mark). Its dim is `SELECT_DIM`.
 * - `level-2-seal`: `SelectedSeal` renders only on a level-1 form (`SEAL_HOSTS`):
 *   a seal anywhere else is a level-2 choice sealed, or a hand-placed seal.
 *
 * Both are `zero`. Comments are stripped, so prose may name what it bans. The
 * Card's seal itself is pinned by `cardSelectSeal.test.tsx` (apps/web).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Finding, Rule, RuleSet } from '../lib/ruleEngine'
import { listFiles } from '../lib/ruleEngine'
import { assertScanFloor } from '../lib/scanFloor'
import { parseCss } from '../lib/styleSource'

const SRC = 'apps/web/src'

/** What makes a file a picker: it draws a select surface. */
const PICKER_MARKS: readonly RegExp[] = [
  /\bselectionRole[=:]/,
  /kind:\s*'select'/,
  /<RadioCard(?:Group)?\b/,
  /<Sel\b/,
  /<SelectSurface\b/,
  /<Checkbox\b/,
  /<Radio\b/,
  /type="(?:radio|checkbox)"/,
  /<EntitySearcher\b/,
]

/**
 * The components that draw select mode for every picker: they define the
 * select treatment rather than consume it, so they are not pickers here.
 */
const SELECT_PARTS = new Set([
  'apps/web/src/components/entity/modes/select.tsx',
  // Its 0.6 is a down unit's condition, not a pick's state.
  'apps/web/src/components/entity/forms/Row.tsx',
  'apps/web/src/components/containers/Sel.tsx',
  'apps/web/src/components/containers/RadioCardGroup.tsx',
  'apps/web/src/components/atoms/Checkbox.tsx',
  'apps/web/src/components/atoms/Radio.tsx',
])

/**
 * The level-1 forms a selected pick is sealed on, and the seal's own module.
 * A new one is added here with the form it is.
 */
const SEAL_HOSTS: Record<string, string> = {
  'apps/web/src/components/entity/modes/select.tsx': 'the seal itself',
  'apps/web/src/components/entity/forms/Row.tsx': 'a Row (level 1)',
  'apps/web/src/components/referenceEntity/card/CardTopRail.tsx': "a Card's rail (level 1)",
  'apps/web/src/components/containers/Sel.tsx': 'a level-1 pick that is no entity',
  'apps/web/src/components/compositions/EntitySearcher.tsx': "the searcher's list (level 1)",
}

const isTest = (rel: string) => rel.includes('/__tests__/') || /\.test\.tsx?$/.test(rel)

/** Blank comments, keeping line numbers, so prose never reads as a use. */
function stripComments(text: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ')
  return text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|\s)\/\/[^\n]*/g, (m, lead) => {
    return lead + blank(m.slice(lead.length))
  })
}

/** An opacity of the file's own: a style-object key or a utility class. */
const OPACITY = /\bopacity\s*:|\bopacity-\d/

/** A stylesheet selector keyed on a pick's state. */
const PICK_STATE =
  /\[(?:data-(?:selected|chosen|unchosen|unticked|picked)|aria-(?:pressed|checked|selected))\b|:checked\b/

function isPicker(rel: string, text: string): boolean {
  return !SELECT_PARTS.has(rel) && PICKER_MARKS.some((m) => m.test(text))
}

/** Every finding in these sources (path relative to the repo root → text). */
export function scanSelectSources(files: ReadonlyMap<string, string>): Record<string, Finding[]> {
  const opacity: Finding[] = []
  const seal: Finding[] = []
  for (const [rel, raw] of files) {
    if (isTest(rel)) continue
    const text = stripComments(raw)
    const lines = text.split('\n')
    if (isPicker(rel, text)) {
      lines.forEach((line, i) => {
        if (OPACITY.test(line)) opacity.push({ file: rel, line: i + 1, detail: line.trim() })
      })
    }
    if (!(rel in SEAL_HOSTS)) {
      lines.forEach((line, i) => {
        if (/<SelectedSeal\b/.test(line)) seal.push({ file: rel, line: i + 1, detail: line.trim() })
      })
    }
  }
  return { 'picker-opacity': opacity, 'level-2-seal': seal }
}

/** Every stylesheet rule keyed on a pick's state that sets an opacity of its own. */
export function scanSelectCss(files: ReadonlyMap<string, string>): Finding[] {
  const out: Finding[] = []
  for (const [rel, text] of files) {
    for (const decl of parseCss(text).decls) {
      if (decl.prop !== 'opacity') continue
      const selector = decl.context.at(-1) ?? ''
      // `1` restores full strength (a reset), which is no dim.
      if (PICK_STATE.test(selector) && decl.value !== '1') {
        out.push({ file: rel, line: decl.line, detail: `${selector} { opacity: ${decl.value} }` })
      }
    }
  }
  return out
}

function sources(root: string): Map<string, string> {
  return new Map(
    listFiles(root, [SRC], ['.ts', '.tsx']).map((rel) => [
      rel,
      readFileSync(join(root, rel), 'utf8'),
    ])
  )
}

const RULES: Rule[] = [
  {
    id: 'picker-opacity',
    mode: 'zero',
    rule: 'hard rule R15 (EDL Modes) — a picker dims with the one select dim, never an opacity of its own',
    fix: "Dim through the card's `selectable={false}`, or give the element `SELECT_DIM` (`components/entity/modes/selectedRing.ts`, `.su-select-dim`). A chosen pick is ringed (`SELECTED_RING`), not brightened.",
  },
  {
    id: 'level-2-seal',
    mode: 'zero',
    rule: 'hard rule R15 (EDL Modes, N7) — the "Selected" seal is a level-1 Row\'s or Card\'s; a level-2 choice is ringed, never sealed',
    fix: "At level 2 pass `selected` to the Token (the ring alone). At level 1 select through a Row's `select` mode, a Card's `selected` or `Sel`, which seal it; a new level-1 form joins SEAL_HOSTS in packages/gates/rules/selectMode.ts.",
  },
]

export const selectMode: RuleSet = {
  id: 'select-mode',
  label: 'select mode (R15)',
  rules: RULES,
  exemptionsLive: 'packages/gates/rules/selectMode.ts (SEAL_HOSTS, SELECT_PARTS)',
  preflight(root) {
    // A catastrophe floor far below today's ~1,000 source files.
    assertScanFloor('select-mode (app source)', listFiles(root, [SRC], ['.ts', '.tsx']).length, 350)
  },
  scan(root) {
    const found = scanSelectSources(sources(root))
    const css = new Map(
      listFiles(root, [SRC], ['.css']).map((rel) => [rel, readFileSync(join(root, rel), 'utf8')])
    )
    found['picker-opacity'] = [...(found['picker-opacity'] ?? []), ...scanSelectCss(css)]
    return found
  },
  summary(root) {
    const files = sources(root)
    const pickers = [...files].filter(
      ([rel, text]) => !isTest(rel) && isPicker(rel, stripComments(text))
    )
    return `${pickers.length} picker file(s) scanned`
  },
}
