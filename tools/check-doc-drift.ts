#!/usr/bin/env bun

/**
 * Doc-drift guard (mechanical, narrow — 7 checks, not a general doc-linter).
 *
 * A prior campaign PR had to hand-fix docs/architecture/package-contracts.md
 * after its "Entry Points" JSON block silently fell out of sync with
 * packages/salvageunion-reference/package.json's real `exports` map (it was
 * missing the `./rules` and `./package.json` entries that had shipped after
 * the doc was written). This script extracts a fact from source and the
 * corresponding claim from docs and asserts they match, so that exact class
 * of drift fails CI instead of sitting unnoticed until the next audit.
 *
 * Checks 4–6 were added after a repo-wide audit found the same drift class
 * running unchecked in three more places while this script sat green: docs
 * citing a superseded ADR as live authority (seven sites on the day ADR-030
 * merged), docs naming component-lib symbols that had been deleted, and
 * "Astro 5" surviving in ten files after `apps/srd` moved to Astro 7.
 *
 * Checks:
 *
 *   1. package-contracts.md's "Entry Points" ```json block for
 *      salvageunion-reference must deep-equal the package's actual
 *      `package.json#exports` map.
 *   2. Every `lib/generated/*.generated.ts` file path referenced in
 *      docs/architecture/package-contracts.md, the package's own CLAUDE.md,
 *      and .claude/rules/package-development.md must exist on disk — catches
 *      the registry-codegen docs drifting from the actual generated-file
 *      layout (e.g. a generated file getting renamed/split/removed without
 *      the docs following).
 *   3. The root CLAUDE.md's "Workspace structure" bullet list must name exactly
 *      the workspaces the root package.json's `apps/*` + `packages/*` globs
 *      resolve to — `apps/su-assets` was a real, deployed workspace member that
 *      no doc mentioned for months.
 *   4. No live-instruction doc may cite a superseded ADR without saying so.
 *      The superseded set is parsed out of each ADR's own `## Status` block, so
 *      marking an ADR superseded is all it takes to arm this check.
 *   5. Every backticked PascalCase symbol a live-instruction doc attributes to
 *      component-lib must still be a barrel export or a file under
 *      `packages/component-lib/src/`.
 *   6. Every "<framework> <major>" claim in the docs must match the version in
 *      the package.json that actually installs that framework.
 *
 * Checks 4 and 5 read *live-instruction* docs only (see LIVE_INSTRUCTION_DOC_DIRS
 * / HISTORICAL_DOCS / HISTORICAL_MENTION). The repo deliberately keeps bannered
 * historical documents that name dead symbols and past decisions on purpose —
 * "its previous version described `ReferenceEntityDisplay`, which no longer
 * exists" is *good* documentation, and a check that fights it would be a check
 * that gets deleted.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertScanFloor } from './lib/scanFloor'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/** The outcome of one check: `failures` empty means it passed. */
export type CheckResult = {
  /** One-line summary printed after a ✓ when the check passes. */
  ok: string
  /** One entry per drift found; empty when the check passes. */
  failures: string[]
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function read(root: string, relPath: string): string {
  return readFileSync(join(root, relPath), 'utf-8')
}

/** Repo-relative paths of the `.md` files directly inside `dir`, sorted. */
function markdownIn(root: string, dir: string): string[] {
  const full = join(root, dir)
  if (!existsSync(full)) return []
  return readdirSync(full)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => `${dir}/${name}`)
}

/**
 * A markdown block: a paragraph, a single list item, a heading, or a fenced
 * block. Blocks are the unit of judgement for checks 4–6 — "is the
 * supersession/version/deleted-ness acknowledged *next to* the claim" is a
 * question about the surrounding sentence, not the whole file.
 */
export type DocBlock = {
  /** Repo-relative path of the doc this block came from. */
  file: string
  /** 1-indexed line number of the block's first line. */
  line: number
  /** The block's raw text. */
  text: string
  /** Heading trail above (and including) the block, outermost first. */
  headings: string[]
}

const FENCE_RE = /^\s{0,3}(```|~~~)/
const HEADING_RE = /^(#{1,6})\s+(.*)$/
const LIST_ITEM_RE = /^\s{0,3}(?:[-*+]|\d+[.)])\s/
/** A markdown link-reference definition — a target, not a citation. */
const LINK_DEFINITION_RE = /^\s*\[[^\]]+\]:\s/

/** 1-indexed file line of `index` within a block's text. */
function lineOf(block: DocBlock, index: number): number {
  return block.line + (block.text.slice(0, index).match(/\n/g)?.length ?? 0)
}

export function splitMarkdownBlocks(
  file: string,
  source: string,
  options: { includeFences?: boolean } = {}
): DocBlock[] {
  const includeFences = options.includeFences ?? false
  const lines = source.split('\n')
  const blocks: DocBlock[] = []
  const headings: string[] = []
  let current: string[] = []
  let currentLine = 0
  let inFence = false

  const flush = (): void => {
    if (current.length === 0) return
    blocks.push({
      file,
      line: currentLine,
      text: current.join('\n'),
      headings: headings.filter(Boolean),
    })
    current = []
  }

  const push = (line: string, lineNumber: number): void => {
    if (current.length === 0) currentLine = lineNumber
    current.push(line)
  }

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1

    if (FENCE_RE.test(line)) {
      if (inFence) {
        if (includeFences) push(line, lineNumber)
        flush()
      } else {
        flush()
        if (includeFences) push(line, lineNumber)
      }
      inFence = !inFence
      continue
    }
    if (inFence) {
      if (includeFences) push(line, lineNumber)
      continue
    }
    if (line.trim() === '') {
      flush()
      continue
    }

    const heading = line.match(HEADING_RE)
    if (heading) {
      flush()
      // biome-ignore lint/style/noNonNullAssertion: both groups are unconditional in HEADING_RE
      const level = heading[1]!.length
      headings.length = level - 1
      // biome-ignore lint/style/noNonNullAssertion: both groups are unconditional in HEADING_RE
      headings[level - 1] = heading[2]!.trim()
      blocks.push({ file, line: lineNumber, text: line, headings: headings.filter(Boolean) })
      continue
    }

    if (LIST_ITEM_RE.test(line)) flush()
    push(line, lineNumber)
  }

  flush()
  return blocks
}

/**
 * Docs an agent reads as a description of the code *as it is now*. Anything not
 * in here (docs/design/, plan-docs/, docs/design-system/, the ADR bodies) is
 * allowed to describe the past.
 */
// `.claude/skills` was the blind spot in this list, and it is where BOTH of the
// live documentation drifts found by the 2026-08 audit sat: the /verify skill
// instructing raw `bun test` (the one command root CLAUDE.md said never to run),
// and the /generate skill describing a TypeScript compile step the package has
// not had since it started shipping source. A skill is executed, not merely
// read, so a stale one is worse than a stale doc — it hands an agent a wrong
// command to run.
const LIVE_INSTRUCTION_DOC_DIRS = [
  '.claude/rules',
  '.claude/agents',
  '.claude/skills',
  'docs/architecture',
]

/**
 * Live-instruction docs that are deliberately historical records. They carry
 * their own "this is what we used to think / what no longer exists" banner, and
 * naming dead things is the entire point of them.
 */
const HISTORICAL_DOCS = new Set([
  'docs/architecture/dashboard-display-completion-plan.md',
  'docs/architecture/game-invites-and-membership-plan.md',
])

/**
 * Per-workspace instruction docs and the two files a new contributor opens
 * first.
 *
 * These were outside the live set, and it showed. `README.md` twice stated the
 * reference package "must be built before the apps can resolve its types" —
 * there has been no such step since the package started shipping TypeScript
 * source — and `packages/salvageunion-reference/README.md` instructed
 * `bun run validate`, which is not a script in that manifest. Check 7 exists to
 * stop docs naming dead commands and was running green while three did.
 *
 * The per-app `CLAUDE.md` files matter more than their size suggests: each is
 * loaded into every agent session scoped to that app, so a false claim there is
 * FOLLOWED rather than read. `apps/itun/CLAUDE.md` still named a
 * `src/components/ui/` directory that does not exist.
 */
function liveInstructionDocs(root: string): string[] {
  const perWorkspace = ['apps', 'packages'].flatMap((dir) => {
    // A test fixture root has neither directory; the filter below drops any
    // path that does not exist, but `readdirSync` on a missing dir throws.
    const base = join(root, dir)
    if (!existsSync(base)) return []
    return readdirSync(base, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => [`${dir}/${entry.name}/CLAUDE.md`, `${dir}/${entry.name}/README.md`])
  })
  return [
    'CLAUDE.md',
    'README.md',
    'CONTRIBUTING.md',
    ...perWorkspace,
    ...LIVE_INSTRUCTION_DOC_DIRS.flatMap((dir) => markdownIn(root, dir)),
  ].filter((doc) => !HISTORICAL_DOCS.has(doc) && existsSync(join(root, doc)))
}

/**
 * A block that is explicitly talking about the past. Checks 4 and 5 skip these:
 * "`StatsBar` (deleted)" and "ADR-001, superseded by ADR-030" are the repo doing
 * the right thing, and a guard that flagged them would train people to delete
 * the banners instead of the drift.
 */
const HISTORICAL_MENTION =
  /\b(no longer|previously|used to|formerly|former|deleted|removed|replaced|renamed|retired|deprecated|superseded|supersedes|absorbed|there is no|do(?:es)? not exist|don't exist|not exported|earlier revisions?|history|historical)\b/i

// ---------------------------------------------------------------------------
// Check 1: Entry Points exports map matches package.json
// ---------------------------------------------------------------------------

export function checkExportsMap(root: string): CheckResult {
  const contractsDoc = 'docs/architecture/package-contracts.md'
  const pkg = JSON.parse(read(root, 'packages/salvageunion-reference/package.json')) as {
    exports?: unknown
  }
  const actualExports = pkg.exports

  const doc = read(root, contractsDoc)
  const sectionMatch = doc.match(/### Entry Points\s*\n\s*```json\n([\s\S]*?)\n```/)

  const ok = 'package-contracts.md "Entry Points" matches package.json#exports.'

  if (!sectionMatch) {
    return {
      ok,
      failures: [
        `Could not find the "### Entry Points" \`\`\`json block in ` +
          `${contractsDoc} — has the section been renamed or removed?`,
      ],
    }
  }

  let documentedExports: unknown
  try {
    // biome-ignore lint/style/noNonNullAssertion: the regex has a single unconditional capture group — a successful match always defines [1]
    documentedExports = JSON.parse(sectionMatch[1]!)
  } catch (err) {
    return {
      ok,
      failures: [
        `The "### Entry Points" \`\`\`json block in ${contractsDoc} ` +
          `is not valid JSON: ${(err as Error).message}`,
      ],
    }
  }

  const actualStr = JSON.stringify(actualExports, null, 2)
  const documentedStr = JSON.stringify(documentedExports, null, 2)

  if (actualStr !== documentedStr) {
    const indent = (s: string) =>
      s
        .split('\n')
        .map((l) => `    ${l}`)
        .join('\n')
    return {
      ok,
      failures: [
        `${contractsDoc}'s "Entry Points" block has drifted from ` +
          `packages/salvageunion-reference/package.json's actual "exports" map.\n\n` +
          `  package.json#exports:\n${indent(actualStr)}\n\n` +
          `  documented:\n${indent(documentedStr)}\n\n` +
          `  → update the doc's JSON block to match package.json exactly.`,
      ],
    }
  }

  return { ok, failures: [] }
}

// ---------------------------------------------------------------------------
// Check 2: every referenced lib/generated/*.generated.ts file exists
// ---------------------------------------------------------------------------

export function checkGeneratedFileReferences(root: string): CheckResult {
  const pkgDir = join(root, 'packages/salvageunion-reference')
  const docsToScan = [
    'docs/architecture/package-contracts.md',
    'packages/salvageunion-reference/CLAUDE.md',
    '.claude/rules/package-development.md',
  ]

  const pattern = /lib\/generated\/[A-Za-z0-9_-]+\.generated\.ts/g
  const referenced = new Set<string>()

  for (const docPath of docsToScan) {
    const fullPath = join(root, docPath)
    if (!existsSync(fullPath)) continue
    for (const match of readFileSync(fullPath, 'utf-8').matchAll(pattern)) {
      referenced.add(match[0])
    }
  }

  if (referenced.size === 0) {
    return {
      ok: 'All referenced lib/generated/*.generated.ts file(s) exist on disk.',
      failures: [
        'Expected at least one lib/generated/*.generated.ts reference across ' +
          `${docsToScan.join(', ')} — did the registry-codegen docs get rewritten ` +
          'to describe the generated files differently? Update this check to match.',
      ],
    }
  }

  const ok = `All ${referenced.size} referenced lib/generated/*.generated.ts file(s) exist on disk.`
  const missing = [...referenced].filter((rel) => !existsSync(join(pkgDir, rel)))

  if (missing.length > 0) {
    return {
      ok,
      failures: [
        `Docs reference generated file(s) that don't exist on disk (stale registry-codegen docs):\n` +
          missing.map((m) => `    packages/salvageunion-reference/${m}`).join('\n') +
          `\n  → run 'bun run build:package' if these should exist, or update the docs if the ` +
          `generated-file layout changed.`,
      ],
    }
  }

  return { ok, failures: [] }
}

// ---------------------------------------------------------------------------
// Check 3: root CLAUDE.md's "Workspace structure" list matches the real
// apps/* + packages/* workspace glob expansion
// ---------------------------------------------------------------------------

export function checkWorkspaceList(root: string): CheckResult {
  const workspaceGlobs = ['apps', 'packages']

  const actual = new Set<string>()
  for (const parent of workspaceGlobs) {
    const parentDir = join(root, parent)
    if (!existsSync(parentDir)) continue
    for (const entry of readdirSync(parentDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      if (!existsSync(join(parentDir, entry.name, 'package.json'))) continue
      actual.add(`${parent}/${entry.name}`)
    }
  }

  const ok = `CLAUDE.md "Workspace structure" names all ${actual.size} workspaces.`

  if (actual.size === 0) {
    return {
      ok,
      failures: [
        `Found no workspace members under ${workspaceGlobs.join('/, ')}/ — is this ` +
          'running from the monorepo root? Update this check if the layout changed.',
      ],
    }
  }

  const doc = read(root, 'CLAUDE.md')
  const sectionMatch = doc.match(/\*\*Workspace structure:\*\*\s*\n([\s\S]*?)\n\s*\n\*\*/)

  if (!sectionMatch) {
    return {
      ok,
      failures: [
        `Could not find the "**Workspace structure:**" bullet list in ` +
          `CLAUDE.md — has the section been renamed or removed?`,
      ],
    }
  }

  const documented = new Set<string>()
  // biome-ignore lint/style/noNonNullAssertion: the regex has a single unconditional capture group — a successful match always defines [1]
  for (const match of sectionMatch[1]!.matchAll(/^-\s+`((?:apps|packages)\/[^/`]+)\/?`/gm)) {
    // biome-ignore lint/style/noNonNullAssertion: the regex has a single unconditional capture group — a successful match always defines [1]
    documented.add(match[1]!)
  }

  const undocumented = [...actual].filter((w) => !documented.has(w)).sort()
  const phantom = [...documented].filter((w) => !actual.has(w)).sort()

  if (undocumented.length > 0 || phantom.length > 0) {
    const bullets = (ws: string[]) => ws.map((w) => `    ${w}/`).join('\n')
    const lines: string[] = []
    if (undocumented.length > 0) {
      lines.push(`  real workspaces missing from the doc:\n${bullets(undocumented)}`)
    }
    if (phantom.length > 0) {
      lines.push(`  documented workspaces that don't exist:\n${bullets(phantom)}`)
    }
    return {
      ok,
      failures: [
        `CLAUDE.md's "Workspace structure" list has drifted from ` +
          `the real apps/* + packages/* workspace expansion.\n\n${lines.join('\n\n')}\n\n` +
          `  → add or remove the bullet(s) so the list names every workspace exactly once.`,
      ],
    }
  }

  return { ok, failures: [] }
}

// ---------------------------------------------------------------------------
// Check 4: no live-instruction doc cites a superseded ADR as live authority
// ---------------------------------------------------------------------------

const ADR_FILE_RE = /^ADR-(\d{3})-.*\.md$/
const ADR_CITATION_RE = /\bADR-(\d{3})\b/g

/** ADR id → the id that superseded it, parsed from each ADR's own Status block. */
export function supersededAdrs(root: string): Map<string, string> {
  const adrDir = join(root, 'docs/adrs')
  const superseded = new Map<string, string>()
  if (!existsSync(adrDir)) return superseded

  for (const name of readdirSync(adrDir).sort()) {
    const idMatch = name.match(ADR_FILE_RE)
    if (!idMatch) continue
    const text = readFileSync(join(adrDir, name), 'utf-8')
    const heading = text.match(/^##\s+Status\s*$/m)
    if (heading?.index === undefined) continue
    const afterHeading = text.slice(heading.index + heading[0].length)
    const nextSection = afterHeading.search(/^##\s/m)
    const status = nextSection === -1 ? afterHeading : afterHeading.slice(0, nextSection)
    // "Superseded by [ADR-030](...)" — the passive form only. "Supersedes
    // [ADR-023]" and "Partially supersedes [ADR-014]" describe the *other* ADR.
    const bySomething = status.match(/superseded\s+by\s+\[?ADR-(\d{3})/i)
    if (!bySomething) continue
    // biome-ignore lint/style/noNonNullAssertion: guarded by the match above
    superseded.set(`ADR-${idMatch[1]!}`, `ADR-${bySomething[1]!}`)
  }

  return superseded
}

export function checkSupersededAdrCitations(root: string): CheckResult {
  const adrDir = join(root, 'docs/adrs')
  const adrCount = existsSync(adrDir)
    ? readdirSync(adrDir).filter((n) => ADR_FILE_RE.test(n)).length
    : 0

  if (adrCount === 0) {
    return {
      ok: 'No live-instruction doc cites a superseded ADR without saying so.',
      failures: [
        'Found no docs/adrs/ADR-NNN-*.md files to parse — has the ADR layout or ' +
          'naming changed? Update this check to match.',
      ],
    }
  }

  const superseded = supersededAdrs(root)
  const ok =
    `No live-instruction doc cites any of the ${superseded.size} superseded ADR(s) ` +
    'without a supersession marker.'
  const failures: string[] = []

  for (const doc of liveInstructionDocs(root)) {
    for (const block of splitMarkdownBlocks(doc, read(root, doc))) {
      // Link-reference definitions are link targets, not claims — blank them out
      // rather than dropping them, so line offsets stay true.
      const lines = block.text.split('\n')
      const scannable = lines.map((line) => (LINK_DEFINITION_RE.test(line) ? '' : line))
      const scannableText = scannable.join('\n')

      const cited = new Set([...scannableText.matchAll(ADR_CITATION_RE)].map((m) => m[0]))
      for (const id of cited) {
        const superseder = superseded.get(id)
        if (!superseder) continue
        if (/supersed/i.test(scannableText)) continue
        if (scannableText.includes(superseder)) continue
        const offset = scannable.findIndex((line) => line.includes(id))
        const citingLine = scannable[offset] ?? ''
        failures.push(
          `${doc}:${block.line + offset} cites ${id} as live authority, but ${id}'s own ` +
            `Status block reads "Superseded by ${superseder}".\n` +
            `    ${citingLine.trim()}\n` +
            `  → cite ${superseder} instead, or mark the citation ` +
            `(e.g. "${id}, superseded by ${superseder}").`
        )
      }
    }
  }

  return { ok, failures }
}

// ---------------------------------------------------------------------------
// Check 5: every component-lib symbol named in a live-instruction doc exists
// ---------------------------------------------------------------------------

/**
 * The docs that describe component-lib's public surface as it is now.
 *
 * The package's own CLAUDE.md and README.md are the two most drift-prone docs
 * in the set — they sit next to the code, so they read as authoritative, and
 * they are where hand-maintained component rosters accumulate. Both were
 * omitted from this list until a repo-wide audit found eight dead symbols
 * across them, including a worked import example that no longer compiled.
 */
/**
 * Backticked PascalCase names that are NOT component-lib symbols, with why.
 *
 * The check attributes a backticked name in a component-lib block to
 * component-lib. That is the right default, but a few names in
 * `docs/design-system/` are correctly backticked as literals while belonging to
 * something else — Ladle's own API and its nav taxonomy. Un-backticking them
 * would be worse: they ARE identifiers, just not ours.
 *
 * Keep this list short. A name here is a claim that it belongs to a different
 * owner, not a way to silence a real dead symbol.
 */
const NOT_COMPONENT_LIB_SYMBOLS = new Map<string, string>([
  ['Story', "@ladle/react's story type, not a component"],
  ['Foundations', 'Ladle nav namespace (a story `title:` prefix)'],
  ['Atoms', 'Ladle nav namespace'],
  ['Compositions', 'Ladle nav namespace'],
  ['Containers', 'Ladle nav namespace'],
  ['Legacy', 'Ladle nav namespace — the unrefreshed holding pen'],
])

function componentLibSymbolDocs(root: string): string[] {
  return [
    'CLAUDE.md',
    ...markdownIn(root, '.claude/rules'),
    ...markdownIn(root, '.claude/agents'),
    'docs/architecture/package-contracts.md',
    'packages/component-lib/CLAUDE.md',
    'packages/component-lib/README.md',
    // `docs/design-system/` declares itself Canon over the components — the
    // ruleset says outright "if a component contradicts a rule here, the
    // component is wrong, never the reverse". A canon doc naming components
    // that do not exist is the worst version of this drift, and §5's atom
    // roster had six such names plus a composition tree citing two deleted
    // ones. Policed here now that §5 states its implementing symbols.
    ...markdownIn(root, 'docs/design-system'),
  ].filter((doc) => existsSync(join(root, doc)))
}

/** Every name a TypeScript source exports, whether re-exported or declared. */
function exportedNamesIn(source: string, into: Set<string>): Set<string> {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

  for (const match of stripped.matchAll(/export\s+(?:type\s+)?\{([\s\S]*?)\}/g)) {
    // biome-ignore lint/style/noNonNullAssertion: the regex has a single unconditional capture group
    for (const entry of match[1]!.split(',')) {
      const parts = entry
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
      const name = (parts.at(-1) ?? '').trim()
      if (name) into.add(name)
    }
  }
  for (const match of stripped.matchAll(
    /export\s+(?:declare\s+)?(?:const|let|function|class|type|interface|enum)\s+([A-Za-z0-9_$]+)/g
  )) {
    // biome-ignore lint/style/noNonNullAssertion: the regex has a single unconditional capture group
    into.add(match[1]!)
  }

  return into
}

/** Every name a barrel file re-exports. */
export function barrelExports(root: string, relPath: string): Set<string> {
  const barrelPath = join(root, relPath)
  const names = new Set<string>()
  if (!existsSync(barrelPath)) return names
  return exportedNamesIn(readFileSync(barrelPath, 'utf-8'), names)
}

/**
 * Every name exported by *any* `.ts`/`.tsx` under `dir` — not just the barrel.
 *
 * A doc that names an internal atom (`StepButton`, deliberately unexported) or a
 * story-harness helper (`Caption`) is describing something that genuinely
 * exists; check 5 asks "does this name exist in the package", not "is it
 * public", so the barrel alone is too narrow a set to answer it.
 */
function exportedSymbolsUnder(root: string, dir: string): Set<string> {
  const names = new Set<string>()
  const full = join(root, dir)
  if (!existsSync(full)) return names

  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      if (!['.ts', '.tsx'].includes(extname(entry.name))) continue
      exportedNamesIn(readFileSync(path, 'utf-8'), names)
    }
  }
  walk(full)

  return names
}

/** Every file/directory name under `packages/component-lib/src/`. */
function componentLibSourceNames(root: string): Set<string> {
  const names = new Set<string>()
  const srcDir = join(root, 'packages/component-lib/src')
  if (!existsSync(srcDir)) return names

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue
      if (entry.isDirectory()) {
        names.add(entry.name)
        walk(join(dir, entry.name))
        continue
      }
      names.add(basename(entry.name, extname(entry.name)).replace(/\.stories$/, ''))
    }
  }
  walk(srcDir)

  return names
}

/** Backticked PascalCase identifiers — `Card`, not `cn`, `UI` or `TECH_LEVEL_STYLES`. */
const BACKTICKED_SYMBOL_RE = /`([A-Z][A-Za-z0-9]*)`/g

export function checkComponentLibSymbolNames(root: string): CheckResult {
  const known = new Set([
    ...barrelExports(root, 'packages/component-lib/src/index.ts'),
    ...exportedSymbolsUnder(root, 'packages/component-lib/src'),
    ...componentLibSourceNames(root),
  ])
  // A block can name component-lib alongside its sibling packages ("all consumer
  // packages (`component-lib`, `srd`, `itun`) … code touching
  // `SalvageUnionReference`"). Those symbols belong to the sibling, not here.
  const siblingExports = exportedSymbolsUnder(root, 'packages/salvageunion-reference/lib')
  const ok = 'Every component-lib symbol named in a live-instruction doc still exists.'

  if (known.size === 0) {
    return {
      ok,
      failures: [
        'Parsed zero names out of packages/component-lib/src — has the package moved? ' +
          'Update this check to match.',
      ],
    }
  }

  const failures: string[] = []

  for (const doc of componentLibSymbolDocs(root)) {
    for (const block of splitMarkdownBlocks(doc, read(root, doc))) {
      const attributed =
        block.text.includes('component-lib') ||
        block.headings.some((heading) => heading.includes('component-lib'))
      if (!attributed) continue
      // A block that is explicitly talking about what was deleted/renamed is
      // *supposed* to name dead symbols.
      if (HISTORICAL_MENTION.test(block.text)) continue

      for (const match of block.text.matchAll(BACKTICKED_SYMBOL_RE)) {
        // biome-ignore lint/style/noNonNullAssertion: the regex has a single unconditional capture group
        const symbol = match[1]!
        if (symbol.length < 2 || !/[a-z]/.test(symbol)) continue
        if (known.has(symbol) || siblingExports.has(symbol)) continue
        if (NOT_COMPONENT_LIB_SYMBOLS.has(symbol)) continue
        failures.push(
          `${doc}:${lineOf(block, match.index)} attributes \`${symbol}\` to component-lib, but it is ` +
            `neither exported from packages/component-lib/src/index.ts nor a file under ` +
            `packages/component-lib/src/.\n` +
            `  → remove the name, or point at what replaced it.`
        )
      }
    }
  }

  return { ok, failures }
}

// ---------------------------------------------------------------------------
// Check 6: documented framework majors match the installed ones
// ---------------------------------------------------------------------------

/** A "<framework> <major>" claim docs make, and the manifest that settles it. */
type FrameworkFact = {
  /** How the framework is written in prose. */
  name: string
  /** Repo-relative package.json that actually installs it. */
  manifest: string
  /** Dependency key inside that manifest. */
  dependency: string
  /** Matches the prose claim, capturing the major version. */
  pattern: RegExp
}

const FRAMEWORKS: FrameworkFact[] = [
  // Was Astro, anchored on apps/srd/package.json. srd no longer installs Astro —
  // it builds through the in-house SSG in apps/srd/ssg, whose only framework
  // dependency is Vite. A "Vite <major>" claim in the docs is now the drifting
  // fact worth pinning for this app.
  {
    name: 'Vite',
    manifest: 'apps/srd/package.json',
    dependency: 'vite',
    pattern: /\bVite\s+v?(\d+)(?:\.\d+)*/g,
  },
  {
    name: 'React',
    manifest: 'apps/itun/package.json',
    dependency: 'react',
    pattern: /\bReact\s+v?(\d+)(?:\.\d+)*/g,
  },
  {
    name: 'Tailwind',
    manifest: 'package.json',
    dependency: 'tailwindcss',
    pattern: /\bTailwind(?:\s+CSS)?\s+v?(\d+)(?:\.\d+)*/g,
  },
]

type CatalogHost = {
  catalog?: Record<string, string>
  catalogs?: Record<string, Record<string, string>>
}

/**
 * Resolve a `catalog:` specifier to the version the root actually declares.
 *
 * `catalog:` uses the DEFAULT catalog; `catalog:<name>` selects a NAMED one —
 * in both cases the key inside the catalog is the package name, never the
 * suffix. Returns undefined for an unknown catalog or a missing entry.
 *
 * Both fields are read from `workspaces` AND from the top level of
 * package.json, because Bun accepts either ("If you put `catalog` or `catalogs`
 * at the top level of the package.json file, that will work too"). This repo
 * uses the `workspaces` form, but the fallback is not hypothetical tidiness:
 * dependabot-core #12522 rewrites this field, and a check that returns
 * undefined here fails `validate:all` with "has the dependency moved?" —
 * pointing at the dependency rather than at the rewrite that actually broke it.
 */
function resolveCatalog(root: string, spec: string, dependency: string): string | undefined {
  const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as CatalogHost & {
    workspaces?: string[] | CatalogHost
  }
  const ws = rootPkg.workspaces
  const hosts: CatalogHost[] = [...(ws && !Array.isArray(ws) ? [ws] : []), rootPkg]

  const name = spec.slice('catalog:'.length).trim()
  for (const host of hosts) {
    const found = name === '' ? host.catalog?.[dependency] : host.catalogs?.[name]?.[dependency]
    if (found !== undefined) return found
  }
  return undefined
}

function installedMajor(root: string, fact: FrameworkFact): string | null {
  const manifestPath = join(root, fact.manifest)
  if (!existsSync(manifestPath)) return null
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  let range =
    manifest.dependencies?.[fact.dependency] ?? manifest.devDependencies?.[fact.dependency]

  // Shared deps are declared once in the root `workspaces.catalog` and referenced
  // as `catalog:` (or `catalog:<name>`) from each workspace, so the manifest no
  // longer carries a version to read. Resolve one hop to the catalog. Without
  // this the check reports "has the dependency moved?" for every catalogued
  // framework — which is exactly what it did when catalogs landed.
  if (range?.startsWith('catalog:')) range = resolveCatalog(root, range, fact.dependency)

  const major = range?.match(/(\d+)/)
  return major?.[1] ?? null
}

/** Docs that describe the stack as it is now. */
function frameworkVersionDocs(root: string): string[] {
  const perWorkspace = ['apps', 'packages'].flatMap((parent) => {
    const parentDir = join(root, parent)
    if (!existsSync(parentDir)) return []
    return readdirSync(parentDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => [
        `${parent}/${entry.name}/CLAUDE.md`,
        `${parent}/${entry.name}/README.md`,
      ])
  })

  return [
    'CLAUDE.md',
    'README.md',
    ...LIVE_INSTRUCTION_DOC_DIRS.flatMap((dir) => markdownIn(root, dir)),
    ...markdownIn(root, 'docs/adrs'),
    ...perWorkspace,
  ].filter((doc) => !HISTORICAL_DOCS.has(doc) && existsSync(join(root, doc)))
}

export function checkFrameworkVersions(root: string): CheckResult {
  const majors = new Map<string, string>()
  const failures: string[] = []

  for (const fact of FRAMEWORKS) {
    const major = installedMajor(root, fact)
    if (major === null) {
      failures.push(
        `Could not read the installed "${fact.dependency}" version from ${fact.manifest} — ` +
          'has the dependency moved? Update this check to match.'
      )
      continue
    }
    majors.set(fact.name, major)
  }

  const ok =
    `Documented framework majors match the installed ones (` +
    `${[...majors].map(([name, major]) => `${name} ${major}`).join(', ')}).`

  if (failures.length > 0) return { ok, failures }

  for (const doc of frameworkVersionDocs(root)) {
    // Fences included: the ASCII dependency diagrams state versions too.
    for (const block of splitMarkdownBlocks(doc, read(root, doc), { includeFences: true })) {
      for (const fact of FRAMEWORKS) {
        const installed = majors.get(fact.name)
        if (!installed) continue
        const claimed = [...block.text.matchAll(fact.pattern)]
        if (claimed.length === 0) continue
        // A block that also states the current major is contextualising the old
        // one ("`srd` was on Astro 5 when this was written; it runs Astro 7 today").
        if (claimed.some((match) => match[1] === installed)) continue

        for (const match of claimed) {
          failures.push(
            `${doc}:${lineOf(block, match.index)} says "${match[0]}", but ${fact.manifest} installs ` +
              `${fact.dependency} ${installed}.x.\n` +
              `  → say "${fact.name} ${installed}", or keep the old number only alongside ` +
              `the current one (e.g. "was on ${fact.name} ${match[1]}, runs ${fact.name} ${installed} today").`
          )
        }
      }
    }
  }

  return { ok, failures }
}

// ---------------------------------------------------------------------------
// Check 7: every `bun run <script>` a live-instruction doc names actually exists
// ---------------------------------------------------------------------------

/**
 * Docs and skills tell agents which commands to run. When a script is renamed
 * or removed, the prose keeps confidently naming it and the next agent runs a
 * command that does not exist — or, worse, the doc names a command that exists
 * but is the wrong one. The /verify skill spent months instructing raw
 * `bun test` because nothing compared instructions against reality.
 *
 * Scope: `bun run <name>` and `bun --filter <workspace> <name>`, which is how
 * every documented command in this repo is written.
 */
function scriptsOf(root: string, manifest: string): Set<string> {
  const path = join(root, manifest)
  if (!existsSync(path)) return new Set()
  const pkg = JSON.parse(readFileSync(path, 'utf-8')) as { scripts?: Record<string, string> }
  return new Set(Object.keys(pkg.scripts ?? {}))
}

/**
 * Workspace directory by package name, for `bun --filter <name> <script>`.
 * Discovered rather than listed, so a new workspace is covered on the day it
 * lands instead of silently escaping the check.
 */
function workspaceManifests(root: string): Record<string, string> {
  return Object.fromEntries(
    ['apps', 'packages'].flatMap((dir) => {
      const base = join(root, dir)
      if (!existsSync(base)) return []
      return readdirSync(base, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .filter((entry) => existsSync(join(base, entry.name, 'package.json')))
        .map((entry) => {
          const manifest = `${dir}/${entry.name}/package.json`
          const pkg = JSON.parse(readFileSync(join(root, manifest), 'utf-8')) as { name?: string }
          return [pkg.name ?? entry.name, manifest] as const
        })
    })
  )
}

/**
 * The workspace a doc belongs to, if any — `apps/srd/CLAUDE.md` → `apps/srd`.
 *
 * A per-workspace doc may reference that workspace's OWN scripts without
 * `--filter`, because that is how you run them from inside the directory:
 * `apps/srd/CLAUDE.md` documents `bun run gate`, which is a script in
 * `apps/srd/package.json` and deliberately not in the root's. Resolving those
 * against the root manifest alone reported four false failures the moment these
 * files entered scope.
 */
function owningManifest(doc: string): string | undefined {
  const m = doc.match(/^((?:apps|packages)\/[^/]+)\//)
  return m ? `${m[1]}/package.json` : undefined
}

function checkReferencedScripts(root: string): { ok: string; failures: string[] } {
  const failures: string[] = []
  const rootScripts = scriptsOf(root, 'package.json')
  const manifests = workspaceManifests(root)
  const workspaceScripts = new Map<string, Set<string>>()
  for (const [name, manifest] of Object.entries(manifests)) {
    workspaceScripts.set(name, scriptsOf(root, manifest))
  }

  let checked = 0
  for (const doc of liveInstructionDocs(root)) {
    const text = readFileSync(join(root, doc), 'utf-8')

    const localScripts = (() => {
      const manifest = owningManifest(doc)
      return manifest ? scriptsOf(root, manifest) : new Set<string>()
    })()

    for (const m of text.matchAll(/\bbun run ([a-z][\w:-]*)/g)) {
      const script = m[1]
      if (script === undefined) continue
      checked++
      if (!rootScripts.has(script) && !localScripts.has(script)) {
        failures.push(
          `${doc} references \`bun run ${script}\`, which is not a script in the root package.json` +
            `${owningManifest(doc) ? ` or in ${owningManifest(doc)}` : ''}.\n` +
            `  → rename the reference to the surviving script, or drop it.`
        )
      }
    }

    for (const m of text.matchAll(/\bbun --filter ([\w-]+) ([a-z][\w:-]*)/g)) {
      const [, workspace, script] = m
      if (workspace === undefined || script === undefined) continue
      const known = workspaceScripts.get(workspace)
      // An unknown workspace name is Check 3's job, not this one.
      if (known === undefined) continue
      checked++
      if (!known.has(script)) {
        failures.push(
          `${doc} references \`bun --filter ${workspace} ${script}\`, which is not a script in ` +
            `${manifests[workspace]}.\n  → rename the reference to the surviving script, or drop it.`
        )
      }
    }
  }

  return { ok: `every documented bun script exists (${checked} references checked)`, failures }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export const CHECKS = [
  checkExportsMap,
  checkGeneratedFileReferences,
  checkWorkspaceList,
  checkSupersededAdrCitations,
  checkComponentLibSymbolNames,
  checkFrameworkVersions,
  checkReferencedScripts,
] as const

export function runChecks(root: string): { failures: string[]; passed: string[] } {
  const failures: string[] = []
  const passed: string[] = []
  for (const check of CHECKS) {
    const result = check(root)
    if (result.failures.length === 0) passed.push(result.ok)
    else failures.push(...result.failures)
  }
  return { failures, passed }
}

if (import.meta.main) {
  // Prove the corpus was actually found before believing anything about it.
  //
  // Three of the checks below are "for every live-instruction doc, assert X",
  // and both directory walkers return `[]` when their directory is missing —
  // which is correct for the fixture trees the tests build, and catastrophic
  // here. Rename a directory in `LIVE_INSTRUCTION_DOC_DIRS` and the corpus
  // silently collapses to the three root files while this still prints
  // `✓ No live-instruction doc cites any of the 4 superseded ADR(s)…`.
  //
  // The tell was missing too: `check-architecture` prints "(588 files checked)"
  // whereas this printed counts of FINDINGS — 4 ADRs, 181 references — never of
  // corpus, so a collapsed scan looked identical to a healthy one.
  //
  // This gate walks the largest tree of any in `validate:all` and was the one
  // `tools/lib/scanFloor.ts` was not applied to when its four siblings were
  // fixed. Floor set well below the real count: a catastrophe detector, not a
  // coverage target.
  assertScanFloor('doc-drift (live-instruction docs)', liveInstructionDocs(repoRoot).length, 6)

  const { failures, passed } = runChecks(repoRoot)
  for (const message of passed) console.log(`✓ ${message}`)
  for (const message of failures) console.error(`✗ ${message}`)
  if (failures.length > 0) {
    console.error(
      `\n${failures.length} doc-drift failure(s) in ${relative(process.cwd(), repoRoot) || '.'}`
    )
    process.exit(1)
  }
}
