/**
 * The canon's gates — `bun run check canon` (`tools/check-canon.ts`).
 *
 * Every law in the design canon (`docs/design-system/`: the ruleset's Source
 * items and § laws, the EDL's E and N rules, chips-and-actions' C rules, the
 * Ledger's L rules, hard-rules' R and K rules) is named here with what
 * holds it, so a law nothing checks cannot land: write its gate, or cut it.
 *
 * A hold is a list of refs, each one of:
 *   - another law's id (`C2b`, `§4.7`): held by that law's gates;
 *   - a rule-set rule, `<set>/<rule>` (`tools/check-rule-sets.ts`);
 *   - a `bun run check` id, `check:<id>` (`tools/check.ts`);
 *   - a file: a repo path, or a basename unique among the gate files
 *     (`chipFill.test.ts`), optionally `#token`, a string the file holds
 *     (an e2e finding's rule, a Biome override's message).
 *
 * Not every gate fails a PR: an e2e spec without the `@pr` tag runs only in
 * the nightly job, and a rule in `apps/web/e2e/_pendingRules.ts` reports
 * under a ceiling. `gateTier` says which, and `--list` prints it beside the
 * gate (`R12  _typeFloor.ts (nightly)`).
 */

import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { listFiles } from './ruleEngine'

export const CANON_DOCS = {
  ruleset: 'docs/design-system/ruleset.md',
  edl: 'docs/design-system/entity-display-language.md',
  chips: 'docs/design-system/chips-and-actions.md',
  ledger: 'docs/design-system/ledger.md',
  hard: 'docs/design-system/hard-rules.md',
} as const

/** Each law and what holds it. */
export const CANON: Readonly<Record<string, readonly string[]>> = {
  // ── ruleset.md: the source ──
  'Source 1': ['Source 2', 'Source 3', 'Source 4', 'Source 5', 'Source 6', 'check:rules-fidelity'],
  'Source 2': ['C10', 'R44', 'EntityDetailDialog.test.tsx'],
  'Source 3': ['R17', '§2.6', 'R68'],
  'Source 4': ['E12'],
  'Source 5': ['R8', 'E17'],
  'Source 6': ['chapters.test.ts', 'guideTone.test.ts', 'contrast.test.ts'],
  'Source 7': ['R10', 'E12', '§4.4', 'R48'],
  // ── ruleset.md: the laws ──
  '§0': ['roster.test.ts', 'R7'],
  '§1': ['§1.1', '§1.2', '§1.3', '§1.8', '§1.9', 'actionPatches.test.ts', 'ConfirmDialog.test.tsx'],
  '§1.1': ['tokens/rust-allowlist', 'Sheet.writesBlocked.test.tsx'],
  '§1.2': ['R11', 'chrome-tokens/dashed'],
  '§1.3': ['R35', 'R10', 'PlayFrame.test.tsx'],
  '§1.4': ['C8', 'PlayActionsColumn.test.tsx', '_hierarchy.ts#use-rust'],
  '§1.5': ['C8'],
  '§1.6': ['E16'],
  '§1.7': ['R17', 'R43', 'pageDescription.test.tsx'],
  '§1.8': [
    'frontDoor.model.test.ts',
    'StartHere.test.tsx',
    '_hierarchy.ts#door-rust',
    'tokens/gradient',
  ],
  '§1.9': [
    'ContainerControls.test.tsx',
    'ContainerPicker.test.tsx',
    'R1',
    '_hierarchy.ts#door-rust',
  ],
  '§1.10': ['_hierarchy.ts#measure', '_hierarchy.ts#first-screen'],
  '§2': ['roster.test.ts'],
  '§2.1': ['VitalGauge.test.tsx', 'R11', '_sheetGrammar.ts#phone-tabs'],
  '§2.2': ['§3.7', 'R12'],
  '§2.3': ['cardStrip.test.tsx', 'C8'],
  '§2.4': ['R8'],
  '§2.5': ['SlotGrid.test.tsx'],
  '§2.6': ['statOrder.test.tsx', 'ledgerColumns.test.tsx', '_ledger.ts#order'],
  '§3': ['§3.1', '§3.12'],
  '§3.1': ['tokens/rust-allowlist', 'Btn.test.tsx', '_hierarchy.ts#use-rust'],
  '§3.2': ['R1', 'C11'],
  '§3.3': [
    'Btn.test.tsx',
    'damagedEffect.test.tsx',
    'paint.test.ts',
    'Mini.test.tsx#data-peek-down',
  ],
  '§3.4': ['chrome/roll-tier', 'R8'],
  '§3.5': ['tokens/gradient', 'tokens/raw-color'],
  '§3.5.1': ['R10'],
  '§3.5.2': ['tokens/gradient', 'designTokens.ts#su-pilot-panel'],
  '§3.6': ['check:rules-fidelity', 'nameRefIndex.test.ts'],
  '§3.7': ['chrome/stat-text', 'chrome/raw-dl'],
  '§3.8': ['tone-ground/tl-ground', 'contrast.test.ts'],
  '§3.9': ['chrome-tokens/dashed', 'R1', 'PatternList.test.tsx'],
  '§3.10': ['chrome-tokens/left-rail'],
  '§3.11': ['AppBar.test.tsx', 'UnionBarSlots.test.tsx'],
  '§3.12': [
    'copy/banned-variant',
    'copy/lowercase-term',
    'chrome-tokens/hand-caps',
    'chrome-tokens/badge-caps-snug',
  ],
  '§3.13': [
    '_hierarchy.ts#door-rust',
    '_hierarchy.ts#use-rust',
    '_hierarchy.ts#band-keyline',
    '_hierarchy.ts#stamp-twin',
  ],
  '§4': ['tokens/raw-color'],
  '§4.1': ['tokens/raw-color', 'tokens/cool-ground', 'tokens/ink-mix'],
  '§4.2': ['tokens/raw-tracking', 'chrome-tokens/badge-caps-snug'],
  '§4.3': ['tokens/raw-border-width', 'R38'],
  '§4.4': [
    'tokens/raw-tracking',
    'tokens/size-literal',
    'tokens/ink-mix',
    'tokens/raw-border-width',
    'tokens/raw-radius',
    'tokens/radius-panel',
    'tokens/raw-spacing',
    'tokens/off-scale-space',
    'K4',
  ],
  '§4.5': ['pipRows.test.ts'],
  '§4.6': ['R12', 'tokens/type-floor', 'sizeHeights.test.ts'],
  '§4.7': ['R12', '_siblingHeights.ts#tab-size'],
  '§4.8': [
    'hierarchy/font-size-rung',
    '_hierarchy.ts#type-ladder',
    'tokens.parity.test.ts#type ladder is rem',
    'design-walk.e2e.ts#findHierarchy',
    '_hierarchy.ts',
  ],
  '§4.9': ['_hierarchy.ts#slab-size', 'R53'],
  '§5': ['roster.test.ts'],
  '§5.1': ['roster.test.ts'],
  '§5.2': ['roster.test.ts', 'R42'],
  '§5.3': ['roster.test.ts'],
  '§5.4': ['§3.7'],
  '§5.5': ['VitalGauge.test.tsx'],
  '§5.6': ['Btn.test.tsx', 'R16'],
  '§5.7': ['R1'],
  '§5.8': ['R8'],
  '§5.9': ['cardStrip.test.tsx'],
  '§5.10': ['SlotGrid.test.tsx'],
  '§5.11': ['K11'],
  '§5.12': ['roster.test.ts', 'L1'],
  '§6': ['roster.test.ts'],
  '§6.1': ['roster.test.ts'],
  '§6.2': ['§3.7', 'R12'],
  '§6.3': ['R12', 'R7'],
  '§6.4': ['R1'],
  '§6.5': ['R16'],
  '§6.6': ['K7', 'R35'],
  '§6.7': ['roster.test.ts'],
  '§7': ['§7.1', '§7.2'],
  '§7.1': ['_valueCells.ts', 'R17'],
  '§7.2': ['_valueCells.ts'],
  K1: ['chrome/ground-signal', 'chrome/paper-mix'],
  K2: ['chrome-tokens/raw-breakpoint'],
  K3: ['chrome-tokens/raw-duration', 'chrome-tokens/raw-easing', 'chrome-tokens/motion-loop'],
  K4: ['tokens/raw-shadow', 'tokens/raw-z-index'],
  K5: ['chrome/one-toaster', 'chrome/offline-copy'],
  K6: ['chrome-tokens/loading-mark', 'copy/banned-variant'],
  K7: ['chrome/dialog-width', 'ModalShell.test.tsx', 'biome.jsonc#K7'],
  K8: ['chrome-tokens/raw-alert', 'copy/banned-variant'],
  K9: ['chrome/focus-ring', 'focusRing.contrast.test.ts'],
  K10: ['controls/tab-role', 'controls/pressed', '_tabLabels.ts'],
  K11: ['controls/icon-size', 'copy/glyph'],
  K12: ['OgCard.test.tsx', 'ogCard.test.ts'],
  K13: ['chromeMatch.test.ts'],
  // ── entity-display-language.md ──
  E1: ['R35'],
  E2: ['R35', 'listingView.test.tsx', 'L9'],
  E3: ['R35'],
  E4: ['Mention.test.tsx', 'rawMarkup.test.ts'],
  E5: ['noWindowOpen.grit', 'useDetailModal.test.tsx'],
  E6: ['N1', 'N2', 'N3', 'N4', 'N8', 'link-heads.e2e.ts'],
  E7: ['modeAnatomy.test.tsx'],
  E9: ['C2', 'R1', 'E17'],
  E10: ['CompactIndex.test.tsx'],
  E11: ['R35'],
  E12: ['toEntityModel.test.ts', 'entityModelParity.test.ts'],
  E13: ['R10'],
  E16: ['peek-terminal.e2e.ts'],
  E17: ['C2', 'C2b'],
  E19: ['R35'],
  E20: ['C2b', '_chipStrips.ts#fill', 'surfaces.test.ts'],
  E22: ['_chipStrips.ts#align', 'R45'],
  E23: ['peekSize.test.tsx', 'CompactBody.test.tsx'],
  E24: ['_hierarchy.ts#title-size', '_hierarchy.ts#slab-size'],
  E25: ['_hierarchy.ts#heading-skip', '_hierarchy.ts#heading-depth'],
  N1: ['nesting-depth.e2e.ts', '_nestingDepth.ts'],
  N2: ['entity-nesting/head-only-token'],
  N3: ['entity-nesting/nested-card-level', '_nestingDepth.ts'],
  N4: ['_nestingDepth.ts', 'nestingDepth.test.ts'],
  N5: ['entity-nesting/no-titled-box', 'R18'],
  N6: ['_nestingDepth.ts', 'WizShell.test.tsx'],
  N7: ['R15', '_nestingDepth.ts'],
  N8: ['R39'],
  // ── chips-and-actions.md ──
  C1a: ['R12', 'C2b'],
  C2: ['_chipStrips.ts#unclassed', 'slabSummary.test.tsx'],
  C2b: ['_chipStrips.ts#taller', '_chipStrips.ts#overflow', 'chipFill.test.ts', 'chipFit.test.ts'],
  C3: ['_chipStrips.ts#clip', 'chip-strips.e2e.ts'],
  C4: ['tokenChips.test.ts', 'Mini.test.tsx'],
  C5: ['_chipStrips.ts#clip', '_chipStrips.ts#more', 'C2b', '_hierarchy.ts#tool-title-clip'],
  C6: ['_chipStrips.ts#gap', 'chip-strips.e2e.ts'],
  C8: ['_stripControls.ts', 'RowControls.test.tsx', 'cardStrip.test.tsx'],
  C9: ['modeAnatomy.test.tsx'],
  C10: ['_chipStrips.ts#foot', 'slabSummary.test.tsx'],
  C11: ['_relationChips.ts', 'copy/banned-variant', 'crewPair.test.ts', 'RelationTag.test.tsx'],
  C13: ['Shelves.test.tsx', 'replica.test.ts'],
  // ── ledger.md ──
  L1: ['_ledger.ts#frame', 'Ledger.test.tsx', 'chrome/raw-table'],
  L2: ['_ledger.ts#tab', '_ledger.ts#sort', 'Ledger.test.tsx'],
  L3: ['Ledger.test.tsx'],
  L4: ['Ledger.test.tsx'],
  L5: ['_ledger.ts#order', '_ledger.ts#empty', 'ledgerColumns.test.tsx'],
  L6: ['Ledger.test.tsx'],
  L7: ['_ledger.ts#picked', 'Ledger.test.tsx', 'R16', 'K9'],
  L8: ['Ledger.test.tsx', '_pageWhole.ts#scroll'],
  L9: ['_ledger.ts', 'Ledger.test.tsx', 'ledgerColumns.test.tsx', 'Shelves.test.tsx'],
  L10: ['SchemaViewerIsland.test.tsx', 'ListingRail.test.tsx'],
  // ── hard-rules.md ──
  R0: ['designRoutes.test.ts', 'design-walk.e2e.ts'],
  R1: ['chrome/slab-section', 'chrome/slab-style', 'SlabSection.test.tsx'],
  R7: ['styling/entity-markup', 'biome.jsonc#R7'],
  R8: ['roll-instrument.e2e.ts'],
  R10: ['tokens/texture-placement', '_texture.ts', 'PlayFrame.test.tsx', 'sheetGrain.test.ts'],
  R11: ['_sheetGrammar.ts', 'sheetGrammar.test.ts', 'SheetModeToggle.test.tsx'],
  R11a: ['oneForm.test.tsx'],
  R12: ['_siblingHeights.ts', '_typeFloor.ts', 'sizeHeights.test.ts', 'biome.jsonc#R12'],
  R15: [
    'select-mode/picker-opacity',
    'select-mode/level-2-seal',
    'cardSelectSeal.test.tsx',
    '_ledger.ts#picked',
  ],
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
  R35: ['_formFits.ts', 'biome.jsonc#R35'],
  R38: [
    'chrome-tokens/entity-frame-ink',
    '_entityFrames.ts',
    'TitledBox.test.tsx',
    'StartHere.test.tsx',
  ],
  R39: ['_nestingDepth.ts#N8', '_ledger.ts'],
  R42: ['_entityFrames.ts#bottom-edge', 'DocPanel.test.tsx'],
  R43: [
    '_pageWhole.ts#fold',
    'pagePresentation.test.tsx',
    'abilityTreeRelations.test.tsx',
    'rollTablePage.test.ts',
    'pageDescription.test.tsx',
  ],
  R44: [
    '_pageWhole.ts#scroll',
    'chapters.test.ts',
    'guideTone.test.ts',
    'toEntityModel.test.ts',
    '_hierarchy.ts#band-keyline',
  ],
  R45: ['token-cutout.e2e.ts'],
  R46: [
    'damagedEffect.test.tsx',
    'CrawlerSheet-bay-fold.test.tsx',
    'CrewLeadMini.test.tsx',
    '_nestingDepth.ts#R46',
    'toEntityModel.test.ts#counts its bays',
    'CrawlerSheet-bay-count.test.tsx',
  ],
  R47: ['CrawlerTechLevelPage.test.tsx', 'CompactIndex.test.tsx'],
  R48: [
    'SchemaViewerIsland.schemas.test.tsx',
    'PilotSheet-abilities.test.tsx',
    'ability-trees.e2e.ts',
  ],
  R49: ['Box.test.tsx', 'AssignedUnits.test.tsx', 'unitOwners.model.test.ts'],
  R50: ['GameHub.connected.test.tsx', 'Roster.test.tsx'],
  R52: ['chrome-tokens/muted-note'],
  R53: ['_hierarchy.ts#stray-head', '_hierarchy.ts#nested-slab'],
  R54: ['hierarchy/bare-applink', 'hierarchy.test.ts'],
  R56: [
    'chipFill.test.ts',
    'PlayLanding.connected.test.tsx',
    'GameHub.connected.test.tsx',
    'indexName.test.ts',
  ],
  R57: ['Sheet-pilot-hero.test.tsx'],
  R58: ['StatusBadge.test.tsx', 'CrawlerSheet-editable.test.tsx'],
  R59: ['PilotSheet-equipment-choices.test.tsx'],
  R60: ['PilotSheet-equipment-choices.test.tsx', 'CatalogChoiceListing.test.tsx'],
  R61: ['SheetHero-fit.test.tsx', 'sheetGrammar.test.ts', 'pageDescription.test.tsx'],
  R62: ['AssignedUnits.test.tsx', 'sheet-rail-links.test.tsx'],
  R65: ['PlayActionsColumn.test.tsx', 'playActions.model.test.ts'],
  R67: ['WizShell.test.tsx', 'mech-wizard.e2e.ts', 'pilot-wizard.e2e.ts', 'crawler-wizard.e2e.ts'],
  R68: ['_fillGrid.ts', 'fill-grid.e2e.ts', 'chrome-tokens/item-grid', 'Grid.test.tsx'],
}

/** A law's id as the canon and its citations spell it. */
const LAW_ID = /^(?:R\d+a?|[EN]\d+|C\d+[ab]?|K\d+|L\d+|§\d+(?:\.\d+)*|Source \d+)$/

/** The ids each canon doc defines, in order. */
export function lawsIn(doc: keyof typeof CANON_DOCS, text: string): string[] {
  const lines = text.split('\n')
  if (doc === 'hard') return lines.flatMap((l) => l.match(/^- \*\*([RK]\d+a?) /)?.slice(1) ?? [])
  if (doc === 'ledger') return lines.flatMap((l) => l.match(/^- \*\*(L\d+) /)?.slice(1) ?? [])
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
  for (const [name, files] of gateFilesByName(root)) byName.set(name, [...files])
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

/** Every gate file under `root`, by basename (a basename ref resolves among these). */
function gateFilesByName(root: string): Map<string, string[]> {
  const byName = new Map<string, string[]>()
  for (const file of [
    ...listFiles(root, GATE_DIRS, GATE_EXTS),
    ...(existsSync(join(root, 'biome.jsonc')) ? ['biome.jsonc'] : []),
  ]) {
    byName.set(basename(file), [...(byName.get(basename(file)) ?? []), file])
  }
  return byName
}

/** When a gate fails: on every PR, only in the nightly e2e job, or never (pending, under a ceiling). */
export type GateTier = 'pr' | 'nightly' | 'pending'

const E2E_DIR = 'apps/web/e2e/'
const PENDING_RULES_FILE = `${E2E_DIR}_pendingRules.ts`
/**
 * The spec that walks every layout gate: on a PR it holds only the gates ci.yml's
 * `E2E_DESIGN_GATES` names, each of which has a `@pr` corpus spec of its own,
 * so importing a scanner does not put it in the PR tier.
 */
const DESIGN_WALK = `${E2E_DIR}design-walk.e2e.ts`

/**
 * Each gate ref's tier, read from the tree under `root`: a rule-set rule, a
 * check and a unit test (an e2e scanner's own included) fail a PR; an e2e spec does when it is tagged `@pr`,
 * an e2e scanner (`_x.ts`) when a `@pr` spec imports it; a pending rule's
 * finding (`_pendingRules.ts`, or `<scanner>#<pending rule>`) never does.
 */
export function gateTier(root: string): (ref: string) => GateTier {
  const byName = gateFilesByName(root)
  const read = (path: string) =>
    existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf-8') : ''
  const pendingText = read(PENDING_RULES_FILE)
  const pendingRules = new Set(
    [...pendingText.matchAll(/^ {2}'?([\w-]+)'?:\s*\{/gm)].map((m) => m[1] ?? '')
  )
  const prSpecs = listFiles(root, [E2E_DIR], ['.ts'])
    .filter((f) => f.endsWith('.e2e.ts') && f !== DESIGN_WALK)
    .map(read)
    .filter((text) => text.includes("'@pr'"))
  return (ref) => {
    if (LAW_ID.test(ref) || ref.startsWith('check:')) return 'pr'
    const [file = '', token] = ref.split('#')
    if (!file.includes('.')) return 'pr'
    const path = file.includes('/') ? file : (byName.get(file)?.[0] ?? file)
    if (!path.startsWith(E2E_DIR) || /\.test\.tsx?$/.test(path)) return 'pr'
    if (path === PENDING_RULES_FILE || (token && pendingRules.has(token))) return 'pending'
    if (path.endsWith('.e2e.ts')) return read(path).includes("'@pr'") ? 'pr' : 'nightly'
    const specifier = `'./${basename(path).replace(/\.ts$/, '')}'`
    return prSpecs.some((text) => text.includes(specifier)) ? 'pr' : 'nightly'
  }
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
