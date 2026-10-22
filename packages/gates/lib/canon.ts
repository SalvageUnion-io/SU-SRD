/**
 * The canon's gates — `bun run check canon` (`tools/check-canon.ts`).
 *
 * Every law in the design canon (`docs/design-system/`: the ruleset's Source
 * items and § laws, chrome.md's K rules, the EDL's E and N rules,
 * chips-and-actions' C rules, hard-rules' R rules) is named here with what
 * holds it, so a law nothing checks cannot land: write its gate, or cut it.
 *
 * A hold is a list of refs, each one of:
 *   - another law's id (`R37`, `§4.7`): held by that law's gates;
 *   - a rule-set rule, `<set>/<rule>` (`tools/check-rule-sets.ts`);
 *   - a `bun run check` id, `check:<id>` (`tools/check.ts`);
 *   - a file: a repo path, or a basename unique among the gate files
 *     (`chipFill.test.ts`), optionally `#token`, a string the file holds
 *     (an e2e finding's rule, a Biome override's message).
 */

import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { listFiles } from './ruleEngine'

export const CANON_DOCS = {
  ruleset: 'docs/design-system/ruleset.md',
  chrome: 'docs/design-system/chrome.md',
  edl: 'docs/design-system/entity-display-language.md',
  chips: 'docs/design-system/chips-and-actions.md',
  hard: 'docs/design-system/hard-rules.md',
} as const

/** Each law and what holds it. */
export const CANON: Readonly<Record<string, readonly string[]>> = {
  // ── ruleset.md: the source ──
  'Source 1': ['Source 2', 'Source 3', 'Source 4', 'Source 5', 'Source 6', 'check:rules-fidelity'],
  'Source 2': ['R4', 'R44'],
  'Source 3': ['R17', '§2.6'],
  'Source 4': ['E12'],
  'Source 5': ['R8', 'E17'],
  'Source 6': ['chapters.test.ts', 'guideTone.test.ts', 'contrast.test.ts'],
  'Source 7': ['R10', 'E12', 'R13', 'R48'],
  // ── ruleset.md: the laws ──
  '§0': ['roster.test.ts', 'R7'],
  '§1': ['§1.1', '§1.2', '§1.3', '§1.9', 'actionPatches.test.ts', 'ConfirmDialog.test.tsx'],
  '§1.1': ['tokens/rust-allowlist', 'Sheet.writesBlocked.test.tsx'],
  '§1.2': ['R11', 'R32'],
  '§1.3': ['R35', 'R10', 'PlayFrame.test.tsx', 'playCanvas.test.tsx'],
  '§1.4': ['R6', 'PlayActionsColumn.test.tsx'],
  '§1.5': ['R6', 'E8'],
  '§1.6': ['R33'],
  '§1.7': ['R17', 'R43'],
  '§1.8': ['E2', 'E3', 'R35'],
  '§1.9': ['ContainerControls.test.tsx', 'ContainerPicker.test.tsx', 'R1'],
  '§2': ['roster.test.ts'],
  '§2.1': ['VitalGauge.test.tsx', 'R11'],
  '§2.2': ['R36', 'R12'],
  '§2.3': ['cardStrip.test.tsx', 'R6'],
  '§2.4': ['R8'],
  '§2.5': ['SlotGrid.test.tsx'],
  '§2.6': ['statOrder.test.tsx'],
  '§2.7': ['E6', 'R35'],
  '§3': ['§3.1', '§3.12'],
  '§3.1': ['tokens/rust-allowlist', 'R9'],
  '§3.2': ['R1', 'C11'],
  '§3.3': ['R9', 'damagedEffect.test.tsx'],
  '§3.4': ['chrome/roll-tier', 'R8'],
  '§3.5': ['tokens/gradient', 'tokens/raw-color'],
  '§3.5.1': ['R10'],
  '§3.5.2': ['tokens/gradient', 'designTokens.ts#su-pilot-panel'],
  '§3.6': ['check:rules-fidelity'],
  '§3.7': ['R36'],
  '§3.8': ['tone-ground/tl-ground', 'contrast.test.ts'],
  '§3.9': ['R32', 'R1', 'PatternList.test.tsx'],
  '§3.10': ['R30'],
  '§3.11': ['AppBar.test.tsx'],
  '§3.12': ['copy/banned-variant', 'copy/lowercase-term', 'R14'],
  '§4': ['tokens/raw-color'],
  '§4.1': ['tokens/raw-color', 'tokens/cool-ground', 'tokens/ink-mix'],
  '§4.2': ['tokens/raw-tracking', 'R14'],
  '§4.3': ['tokens/raw-border-width', 'R38'],
  '§4.4': ['R13', 'R26'],
  '§4.5': ['pipRows.test.ts'],
  '§4.6': ['R12', 'tokens/type-floor', 'touchFloor.test.ts'],
  '§4.7': ['R12', 'R41'],
  '§5': ['roster.test.ts'],
  '§5.1': ['roster.test.ts'],
  '§5.2': ['roster.test.ts', 'R42'],
  '§5.3': ['roster.test.ts'],
  '§5.4': ['R36'],
  '§5.5': ['VitalGauge.test.tsx'],
  '§5.6': ['R9', 'R16'],
  '§5.7': ['R1'],
  '§5.8': ['R8'],
  '§5.9': ['cardStrip.test.tsx'],
  '§5.10': ['SlotGrid.test.tsx'],
  '§5.11': ['R23'],
  '§6': ['roster.test.ts'],
  '§6.1': ['roster.test.ts'],
  '§6.2': ['R36', 'R12'],
  '§6.3': ['R12', 'R7'],
  '§6.4': ['R1'],
  '§6.5': ['R16'],
  '§6.6': ['R24', 'R35'],
  '§6.7': ['roster.test.ts'],
  '§7': ['§7.1', '§7.2'],
  '§7.1': ['R31', 'R17'],
  '§7.2': ['R31'],
  '§8': ['K1'],
  // ── chrome.md ──
  K1: ['R19'],
  K2: ['R21'],
  K3: ['R25'],
  K4: ['R26'],
  K5: ['R20'],
  K6: ['R22'],
  K7: ['R24'],
  K8: ['R27'],
  K9: ['R28'],
  K10: ['R29'],
  K11: ['R23'],
  // ── entity-display-language.md ──
  E1: ['R35'],
  E2: ['R35'],
  E3: ['R35'],
  E4: ['Mention.test.tsx', 'rawMarkup.test.ts'],
  E5: ['R34'],
  E6: ['N1', 'N2', 'N3', 'N4', 'N8'],
  E7: ['modeAnatomy.test.tsx'],
  E8: ['R6'],
  E9: ['R4', 'R1', 'E17'],
  E10: ['CompactIndex.test.tsx'],
  E11: ['R35'],
  E12: ['toEntityModel.test.ts', 'entityModelParity.test.ts'],
  E13: ['R10'],
  E14: ['R8'],
  E15: ['R7', 'R18'],
  E16: ['R33'],
  E17: ['C2', 'C2a', 'C2b'],
  E18: ['C5'],
  E19: ['R35'],
  E20: ['R37', '_chipStrips.ts#fill', 'surfaces.test.ts'],
  E21: ['R38'],
  E22: ['R40', 'R45'],
  N1: ['nesting-depth.e2e.ts', '_nestingDepth.ts'],
  N2: ['entity-nesting/head-only-token'],
  N3: ['entity-nesting/nested-card-level', '_nestingDepth.ts'],
  N4: ['_nestingDepth.ts', 'nestingDepth.test.ts'],
  N5: ['entity-nesting/no-titled-box', 'R18'],
  N6: ['_nestingDepth.ts', 'WizShell.test.tsx'],
  N7: ['R15', '_nestingDepth.ts'],
  N8: ['R39'],
  // ── chips-and-actions.md ──
  C1: ['R6'],
  C1a: ['R12', 'R37'],
  C2: ['R4'],
  C2a: ['R4'],
  C2b: ['R37'],
  C3: ['R3'],
  C4: ['tokenChips.test.ts', 'Mini.test.tsx'],
  C5: ['R3', 'R37'],
  C6: ['R2'],
  C7: ['R2'],
  C8: ['R6'],
  C9: ['modeAnatomy.test.tsx'],
  C10: ['R4'],
  C11: ['R5', 'RelationTag.test.tsx'],
  // ── hard-rules.md ──
  R0: ['designRoutes.test.ts', 'design-walk.e2e.ts'],
  R1: ['chrome/slab-section', 'chrome/slab-style', 'SlabSection.test.tsx'],
  R2: ['_chipStrips.ts#gap', 'chip-strips.e2e.ts'],
  R3: ['_chipStrips.ts#clip', '_chipStrips.ts#more', 'chip-strips.e2e.ts'],
  R4: ['_chipStrips.ts#unclassed', '_chipStrips.ts#foot', 'slabSummary.test.tsx'],
  R5: ['_relationChips.ts', 'copy/banned-variant'],
  R6: ['_stripControls.ts', 'RowControls.test.tsx', 'cardStrip.test.tsx'],
  R7: ['styling/entity-markup', 'biome.jsonc#R7'],
  R8: ['roll-instrument.e2e.ts'],
  R9: ['Btn.test.tsx'],
  R10: ['tokens/texture-placement', '_texture.ts', 'PlayFrame.test.tsx'],
  R11: ['_sheetGrammar.ts', 'sheetGrammar.test.ts'],
  R12: ['_siblingHeights.ts', '_typeFloor.ts', 'touchFloor.test.ts', 'biome.jsonc#R12'],
  R13: [
    'tokens/raw-tracking',
    'tokens/size-literal',
    'tokens/ink-mix',
    'tokens/raw-border-width',
    'tokens/raw-radius',
    'tokens/radius-panel',
    'tokens/raw-spacing',
    'tokens/off-scale-space',
  ],
  R14: ['chrome-tokens/hand-caps', 'chrome-tokens/badge-caps-snug'],
  R15: ['select-mode/picker-opacity', 'select-mode/level-2-seal', 'cardSelectSeal.test.tsx'],
  R16: [
    'chrome/raw-field',
    'chrome/raw-label',
    'chrome/breadcrumb-nav',
    'chrome/step-current',
    'chrome/button-href',
    'chrome/raw-button',
    'ChipListEditor.test.tsx',
  ],
  R17: ['page-rhythm.e2e.ts', '_pageRhythm.ts'],
  R18: ['entity-nesting/named-block'],
  R19: ['chrome/ground-signal', 'chrome/paper-mix'],
  R20: ['chrome/one-toaster', 'chrome/offline-copy', 'chrome/roll-tier'],
  R21: ['chrome-tokens/raw-breakpoint'],
  R22: ['chrome-tokens/loading-mark', 'copy/banned-variant'],
  R23: ['controls/icon-size', 'copy/glyph'],
  R24: ['chrome/dialog-width', 'ModalShell.test.tsx', 'biome.jsonc#R24'],
  R25: ['chrome-tokens/raw-duration', 'chrome-tokens/raw-easing', 'chrome-tokens/motion-loop'],
  R26: ['tokens/raw-shadow', 'tokens/raw-z-index'],
  R27: ['chrome-tokens/raw-alert', 'copy/banned-variant'],
  R28: ['chrome/focus-ring', 'focusRing.contrast.test.ts'],
  R29: ['controls/tab-role', 'controls/pressed', '_tabLabels.ts'],
  R30: ['chrome-tokens/left-rail'],
  R31: ['_valueCells.ts'],
  R32: ['chrome-tokens/dashed'],
  R33: ['peek-terminal.e2e.ts'],
  R34: ['noWindowOpen.grit', 'useDetailModal.test.tsx'],
  R35: ['_formFits.ts', 'biome.jsonc#R35'],
  R36: ['chrome/stat-text', 'chrome/raw-dl'],
  R37: ['_chipStrips.ts#taller', '_chipStrips.ts#overflow', 'chipFill.test.ts', 'chipFit.test.ts'],
  R38: ['chrome-tokens/entity-frame-ink', '_entityFrames.ts'],
  R39: ['_nestingDepth.ts#N8'],
  R40: ['_chipStrips.ts#align', '_pendingRules.ts#R40'],
  R41: ['_siblingHeights.ts#tab-size', '_pendingRules.ts#R41'],
  R42: ['_entityFrames.ts#bottom-edge', 'DocPanel.test.tsx'],
  R43: [
    '_pageWhole.ts#fold',
    'pagePresentation.test.tsx',
    'abilityTreeRelations.test.tsx',
    'rollTablePage.test.ts',
  ],
  R44: ['_pageWhole.ts#scroll', 'chapters.test.ts', 'guideTone.test.ts'],
  R45: ['token-cutout.e2e.ts'],
  R46: [
    'damagedEffect.test.tsx',
    'CrawlerSheet-bay-fold.test.tsx',
    'CrewLeadMini.test.tsx',
    '_nestingDepth.ts#R46',
  ],
  R47: ['CrawlerTechLevelPage.test.tsx', 'CompactIndex.test.tsx'],
  R48: ['SchemaViewerIsland.schemas.test.tsx', 'PilotSheet-abilities.test.tsx'],
  R49: ['Box.test.tsx', 'AssignedUnits.test.tsx', 'unitOwners.model.test.ts'],
  R50: ['GameHub.connected.test.tsx', 'Roster.test.tsx'],
  R51: ['TitledBox.test.tsx', 'StartHere.test.tsx'],
}

/** A law's id as the canon and its citations spell it. */
const LAW_ID = /^(?:R\d+|[EN]\d+|C\d+[ab]?|K\d+|§\d+(?:\.\d+)*|Source \d+)$/

/** The ids each canon doc defines, in order. */
export function lawsIn(doc: keyof typeof CANON_DOCS, text: string): string[] {
  const lines = text.split('\n')
  if (doc === 'hard') return lines.flatMap((l) => l.match(/^- \*\*(R\d+) /)?.slice(1) ?? [])
  if (doc === 'chrome') return lines.flatMap((l) => l.match(/^- \*\*(K\d+) /)?.slice(1) ?? [])
  if (doc === 'chips')
    return lines.flatMap((l) => l.match(/^- \*\*(C\d+[ab]?)\*\*/)?.slice(1) ?? [])
  if (doc === 'edl')
    return lines.flatMap((l) => [...l.matchAll(/\*\*([EN]\d+)\*\*/g)].map((m) => m[1] ?? ''))
  return rulesetLaws(lines)
}

/**
 * The ruleset's ids: `Source n` under its first section, then each numbered
 * law under "The laws" by its nesting (`§3.5.1`); a line may number several
 * items of one list (§5's atoms).
 */
function rulesetLaws(lines: readonly string[]): string[] {
  const ids: string[] = []
  let section = ''
  let path: string[] = []
  for (const line of lines) {
    if (line.startsWith('## ')) {
      section = line
      path = []
      continue
    }
    const head = line.match(/^( *)(\d+)\. \*\*/)
    if (!head) continue
    const depth = Math.floor((head[1] ?? '').length / 3)
    if (/source/i.test(section)) {
      ids.push(`Source ${head[2]}`)
      continue
    }
    for (const item of line.matchAll(/(?:^ *|\s)(\d+)\. \*\*/g)) {
      path = [...path.slice(0, depth), item[1] ?? '']
      ids.push(`§${path.join('.')}`)
    }
  }
  return ids
}

/** Every id the canon docs define, with the doc that defines it. */
export function canonLaws(root: string): Map<string, string> {
  const laws = new Map<string, string>()
  for (const [doc, path] of Object.entries(CANON_DOCS) as [keyof typeof CANON_DOCS, string][]) {
    if (!existsSync(join(root, path))) continue
    for (const id of lawsIn(doc, readFileSync(join(root, path), 'utf-8'))) {
      if (!laws.has(id)) laws.set(id, path)
    }
  }
  return laws
}

/** Where a gate's file may live: a basename ref resolves among these. */
const GATE_DIRS = ['apps', 'packages', 'tools']
const GATE_EXTS = ['.ts', '.tsx', '.grit']

export type CanonContext = {
  /** `<set>/<rule>` ids of every rule-set rule. */
  rules: ReadonlySet<string>
  /** `bun run check` ids. */
  checks: ReadonlySet<string>
}

/**
 * What is wrong with the registry against the docs under `root`: a law with no
 * entry, an entry for no law, a ref that resolves to nothing, a law held by
 * nothing but other laws in a loop.
 */
export function canonFaults(
  root: string,
  context: CanonContext,
  canon: Readonly<Record<string, readonly string[]>> = CANON
): string[] {
  const faults: string[] = []
  const laws = canonLaws(root)
  for (const [id, doc] of laws) {
    if (!(id in canon)) faults.push(`${id} (${doc}) names no gate: add its entry to CANON`)
  }
  const byName = new Map<string, string[]>()
  for (const file of [
    ...listFiles(root, GATE_DIRS, GATE_EXTS),
    ...(existsSync(join(root, 'biome.jsonc')) ? ['biome.jsonc'] : []),
  ]) {
    byName.set(basename(file), [...(byName.get(basename(file)) ?? []), file])
  }
  for (const [id, refs] of Object.entries(canon)) {
    if (!laws.has(id)) faults.push(`CANON names ${id}, which no canon doc defines: remove it`)
    if (refs.length === 0) faults.push(`${id} is held by nothing: name its gate, or cut the law`)
    for (const ref of refs) {
      const fault = refFault(root, ref, laws, byName, context)
      if (fault) faults.push(`${id}: ${fault}`)
    }
  }
  for (const [id, refs] of Object.entries(canon)) {
    const named = refs.length > 0 && refs.every((ref) => !LAW_ID.test(ref) || ref in canon)
    if (laws.has(id) && named && !reachesGate(id, canon, new Set())) {
      faults.push(`${id} is held only by laws that lead back to it: name a gate`)
    }
  }
  return faults
}

function refFault(
  root: string,
  ref: string,
  laws: ReadonlyMap<string, string>,
  byName: ReadonlyMap<string, readonly string[]>,
  context: CanonContext
): string | null {
  if (LAW_ID.test(ref)) return laws.has(ref) ? null : `${ref} is no law in the canon`
  if (ref.startsWith('check:')) {
    return context.checks.has(ref.slice(6)) ? null : `${ref} is no \`bun run check\` id`
  }
  const [file = '', token] = ref.split('#')
  if (!file.includes('.')) {
    return context.rules.has(file) ? null : `${ref} is no rule-set rule`
  }
  let path = file
  if (!file.includes('/')) {
    const found = byName.get(file) ?? []
    if (found.length !== 1) {
      return found.length === 0
        ? `${file} is no gate file`
        : `${file} names ${found.length} files: give its path`
    }
    path = found[0] ?? file
  }
  if (!existsSync(join(root, path))) return `${path} does not exist`
  if (token && !readFileSync(join(root, path), 'utf-8').includes(token)) {
    return `${path} holds no "${token}"`
  }
  return null
}

/** Whether `id`'s hold reaches a gate (a ref that is no law) through the laws it names. */
function reachesGate(
  id: string,
  canon: Readonly<Record<string, readonly string[]>>,
  seen: Set<string>
): boolean {
  if (seen.has(id)) return false
  seen.add(id)
  return (canon[id] ?? []).some((ref) => !LAW_ID.test(ref) || reachesGate(ref, canon, seen))
}

/** Each law's gates, laws it names followed through to theirs, for `--list`. */
export function gatesOf(
  id: string,
  canon: Readonly<Record<string, readonly string[]>> = CANON
): string[] {
  const out = new Set<string>()
  const walk = (at: string, seen: Set<string>) => {
    if (seen.has(at)) return
    seen.add(at)
    for (const ref of canon[at] ?? []) {
      if (LAW_ID.test(ref)) walk(ref, seen)
      else out.add(ref)
    }
  }
  walk(id, new Set())
  return [...out]
}
