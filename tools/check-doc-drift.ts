#!/usr/bin/env bun
/**
 * Doc drift — `bun run check doc-drift`. Six checks, each asking whether
 * what a doc tells a reader is still true:
 *
 *   paths    every backticked repo path in a live-instruction doc exists,
 *            unless the words beside it mark it as history or a proposal.
 *            Under `# Decisions`, only the Status and Decision of an ADR that
 *            still carries a Decision are scanned: they state what governs
 *            now; the rest of an ADR is the record of how it was decided.
 *   scripts  every `bun run <script>`, `bun --filter <ws> <script>` and
 *            `bun run check <id>` in that same text, or in a Claude hook,
 *            names a real script or check id.
 *   claims   no agent doc (the live text of the docs above, the hooks and
 *            `.env.example`) repeats a claim the repo has retired
 *            (`RETIRED_CLAIMS`).
 *   decisions every ADR is one bare `## ADR-NNN` heading under `# Decisions`
 *            in docs/ARCHITECTURE.md, none missing or repeated, docs/adrs/
 *            stays gone, and an ADR whose Status amends, supersedes or
 *            reverses another is named in that other ADR's Status.
 *   links    every relative markdown link in a tracked `.md` file resolves,
 *            and its `#fragment`, into a `.md` file or the same file, names a
 *            heading there.
 *   size     root and per-directory CLAUDE.md files and `.claude/agents/*.md`
 *            stay under 8,000 characters and `.claude/rules/*.md` under 4,000.
 *            They load into every agent session in scope, so growth costs
 *            every session. A collapsed doc (`COLLAPSED_DOCS`) holds its own
 *            budget on its live text: it replaced a folder, and terse is the
 *            point; the ADRs below it are an append-only record.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { CHECK_IDS } from './check'
import { assertScanFloor } from './lib/scanFloor'

const repoRoot = join(import.meta.dir, '..')

/** The outcome of one check: `failures` empty means it passed. */
export type CheckResult = { ok: string; failures: string[] }

const read = (root: string, relPath: string): string => readFileSync(join(root, relPath), 'utf-8')

/** Repo-relative paths of the `.md` files at or below `dir`, sorted. */
function markdownIn(root: string, dir: string): string[] {
  const full = join(root, dir)
  if (!existsSync(full)) return []
  const found: string[] = []
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    if (entry.isDirectory()) found.push(...markdownIn(root, `${dir}/${entry.name}`))
    else if (entry.name.endsWith('.md')) found.push(`${dir}/${entry.name}`)
  }
  return found.sort()
}

/** Files in `dir` with extension `ext`, sorted, repo-relative. */
function filesIn(root: string, dir: string, ext: string): string[] {
  const full = join(root, dir)
  if (!existsSync(full)) return []
  return readdirSync(full)
    .filter((name) => name.endsWith(ext))
    .sort()
    .map((name) => `${dir}/${name}`)
}

/** Every workspace directory: each `apps/*` and `packages/*`, and `tools/`. */
function workspaceDirs(root: string): string[] {
  const nested = ['apps', 'packages'].flatMap((dir) => {
    const base = join(root, dir)
    if (!existsSync(base)) return []
    return readdirSync(base, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${dir}/${entry.name}`)
  })
  return existsSync(join(root, 'tools')) ? [...nested, 'tools'] : nested
}

/** Docs an agent follows as a description of the code as it is now. */
const LIVE_INSTRUCTION_DOC_DIRS = [
  '.claude/rules',
  '.claude/agents',
  '.claude/skills',
  'docs/architecture',
]

function liveInstructionDocs(root: string): string[] {
  return [
    'CLAUDE.md',
    'README.md',
    'docs/ARCHITECTURE.md',
    ...workspaceDirs(root).map((ws) => `${ws}/CLAUDE.md`),
    ...LIVE_INSTRUCTION_DOC_DIRS.flatMap((dir) => markdownIn(root, dir)),
  ].filter((doc) => existsSync(join(root, doc)))
}

const hookScripts = (root: string): string[] => filesIn(root, '.claude/hooks', '.sh')

/** Markdown text split into blocks (blank-line separated; list items apart), fences dropped. */
export function splitMarkdownBlocks(source: string): { line: number; text: string }[] {
  const blocks: { line: number; text: string }[] = []
  let current: string[] = []
  let start = 0
  let inFence = false
  const flush = () => {
    if (current.length > 0) blocks.push({ line: start, text: current.join('\n') })
    current = []
  }
  for (const [index, line] of source.split('\n').entries()) {
    if (/^\s{0,3}(```|~~~)/.test(line)) {
      flush()
      inFence = !inFence
      continue
    }
    if (inFence) continue
    if (line.trim() === '' || /^#{1,6}\s/.test(line) || /^\s{0,3}(?:[-*+]|\d+[.)])\s/.test(line)) {
      flush()
    }
    if (line.trim() === '') continue
    if (current.length === 0) start = index + 1
    current.push(line)
  }
  flush()
  return blocks
}

const lineOf = (block: { line: number; text: string }, index: number): number =>
  block.line + (block.text.slice(0, index).match(/\n/g)?.length ?? 0)

/** The heading that opens the architecture decision records. */
const DECISIONS_HEADING = /^# Decisions$/m

/**
 * A markdown doc up to its `# Decisions` heading: the part that describes the
 * code as it is now.
 */
export function liveTextOf(source: string): string {
  const at = source.search(DECISIONS_HEADING)
  return at === -1 ? source : source.slice(0, at)
}

/** One `## ADR-NNN` section: its number and its lines, `start` 0-based in the doc. */
type AdrSection = { n: number; start: number; lines: string[] }

/** The ADR sections under `# Decisions`, each running to the next `## ` heading. */
export function adrSections(source: string): AdrSection[] {
  const lines = source.split('\n')
  const decisions = lines.findIndex((line) => DECISIONS_HEADING.test(line))
  if (decisions === -1) return []
  const sections: AdrSection[] = []
  let inFence = false
  for (let i = decisions + 1; i < lines.length; i++) {
    const line = lines[i] as string
    if (/^\s{0,3}(```|~~~)/.test(line)) inFence = !inFence
    if (inFence) continue
    const adr = line.match(/^##\s+ADR-(\d+)/)
    if (adr) sections.push({ n: Number(adr[1]), start: i, lines: [] })
    else if (/^##\s/.test(line)) sections.push({ n: Number.NaN, start: i, lines: [] })
    sections.at(-1)?.lines.push(line)
  }
  return sections.filter((section) => !Number.isNaN(section.n))
}

/** Line offsets (within the section) of its `### <name>` subsection's body. */
function subsectionLines(section: AdrSection, name: string): number[] {
  const out: number[] = []
  let inside = false
  for (const [i, line] of section.lines.entries()) {
    if (/^###\s/.test(line)) inside = line.trim() === `### ${name}`
    else if (inside) out.push(i)
  }
  return out
}

/** The text of an ADR's `### Status`. */
const statusOf = (section: AdrSection): string =>
  subsectionLines(section, 'Status')
    .map((i) => section.lines[i])
    .join('\n')

/**
 * The part of a doc whose paths and scripts must exist: its live text, plus the
 * Status and Decision of every ADR that still carries a `### Decision` (a
 * superseded ADR is a stub: heading, Status and a `git show` pointer). Every
 * other line is blanked, so line numbers still match the file.
 */
export function checkedTextOf(source: string): string {
  const at = source.search(DECISIONS_HEADING)
  if (at === -1) return source
  const lines = source.split('\n')
  const keep = new Set<number>()
  for (let i = 0; i < source.slice(0, at).split('\n').length - 1; i++) keep.add(i)
  for (const section of adrSections(source)) {
    if (!section.lines.some((line) => line.trim() === '### Decision')) continue
    for (const name of ['Status', 'Decision']) {
      for (const i of subsectionLines(section, name)) keep.add(section.start + i)
    }
  }
  return lines.map((line, i) => (keep.has(i) ? line : '')).join('\n')
}

// ─── paths ──────────────────────────────────────────────────────────────────

/** First segments of a repo-rooted citation; any other slashed token is a package, ref or type. */
const REPO_PATH_ROOTS = [
  '.claude',
  '.github',
  'apps',
  'packages',
  'tools',
  'docs',
  'test',
  'patches',
]

/** Directories that exist only inside a workspace: resolved under any `apps/*` / `packages/*`. */
const WORKSPACE_PATH_ROOTS = ['src', 'ssg', 'convex', 'scripts', 'lib', 'e2e', 'public']

/** Dependencies whose name is also a workspace directory: `convex/react` is an import. */
const IMPORT_SPECIFIER_PACKAGES = new Set(['convex'])

/** Words that offer a path as not yet built. Judged on prose with backticked spans removed. */
const CITATION_PROPOSAL =
  /\b(planned|proposed|propose|proposes|does not exist yet|doesn't exist yet|not yet exist)\b/

/** "Create `x`" as an imperative opening its sentence; bare "create" is often a noun here. */
const CITATION_IMPERATIVE_CREATE = /^[\s>*_\-+|]*(?:\d+[.)]\s+)?create\b/

/** Words that say the cited path itself is gone. */
const CITATION_HISTORY =
  /\b(deleted|removed|retired|no longer|used to|formerly|never existed|does not exist|did not exist|never written|was renamed|superseded)\b/

/** A doc whose opening status line declares it a plan: every path in it is a proposal. */
const PLAN_DOC_STATUS = /^>?\s*\*\*Status:?\*\*:?\s*(?:plan|proposed|proposal|draft)\b/im

/** Root-level config files named bare, e.g. `bunfig.toml`, `lefthook.yml`. */
const BARE_CONFIG_FILE_RE = /^[A-Za-z0-9_-]+\.(?:toml|yaml|yml)$/

/** Words either side of a citation that may mark it as history or a proposal. */
const CITATION_CONTEXT_WORDS = 6

/** The repo path a backticked token names, or null when it is not a path claim. */
export function pathCandidate(token: string): string | null {
  const candidate = token.replace(/(?::\d+)+$/, '').replace(/#[\w-]*$/, '')
  // Globs, placeholders, URLs, env expansions and home paths name a set or a template.
  if (/[*<>{}$~?\s]|:\/\//.test(candidate) || candidate.includes(':')) return null
  if (candidate.endsWith('.') || candidate.startsWith('/')) return null
  if (BARE_CONFIG_FILE_RE.test(candidate)) return candidate
  if (!candidate.includes('/')) return null
  const first = candidate.split('/')[0] ?? ''
  if (
    IMPORT_SPECIFIER_PACKAGES.has(first) &&
    !/\.\w+$/.test(candidate) &&
    !candidate.endsWith('/')
  ) {
    return null
  }
  if (REPO_PATH_ROOTS.includes(first) || WORKSPACE_PATH_ROOTS.includes(first)) return candidate
  return null
}

/**
 * "This path is gitignored at the repo root": absent in CI by design, so its
 * existence proves nothing. Handles the rule shapes the root `.gitignore` uses.
 */
export function gitignoredMatcher(root: string): (candidate: string) => boolean {
  const file = join(root, '.gitignore')
  if (!existsSync(file)) return () => false
  const rules = readFileSync(file, 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#') && !line.startsWith('!'))
  return (candidate) =>
    rules.some((line) => {
      const rule = line.replace(/^\//, '')
      const bare = rule.replace(/\/$/, '')
      // An unanchored pattern with no inner slash matches that name at any depth.
      if (!line.startsWith('/') && !bare.includes('/') && !bare.includes('*')) {
        return candidate.split('/').includes(bare)
      }
      if (rule.startsWith('**/')) {
        const name = rule.slice(3)
        return candidate.startsWith(name) || candidate.includes(`/${name}`)
      }
      if (rule.endsWith('/*')) return candidate.startsWith(rule.slice(0, -1))
      if (rule.includes('*')) return false
      return candidate === rule || candidate.startsWith(rule.endsWith('/') ? rule : `${rule}/`)
    })
}

/** Docs cite modules the way code imports them, without an extension. */
const existsAsModule = (path: string): boolean =>
  ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].some((suffix) => existsSync(`${path}${suffix}`))

function resolvesFrom(root: string, doc: string, candidate: string, workspaces: string[]): boolean {
  if (existsAsModule(join(root, candidate))) return true
  if (existsAsModule(join(root, dirname(doc), candidate))) return true
  const first = candidate.split('/')[0] ?? ''
  if (WORKSPACE_PATH_ROOTS.includes(first) || first === 'test') {
    return workspaces.some(
      (ws) =>
        existsAsModule(join(root, ws, candidate)) ||
        existsAsModule(join(root, ws, 'src', candidate))
    )
  }
  if (BARE_CONFIG_FILE_RE.test(candidate)) {
    return existsSync(join(root, '.github/workflows', candidate))
  }
  return false
}

/**
 * Bounds of the sentence containing `index`. A sentence ends at `.!?;` plus
 * any closing markup before whitespace; every table row and list item is its
 * own unit, so one history word cannot excuse a whole table.
 */
function sentenceBounds(text: string, index: number): [number, number] {
  const boundary = /[.!?;][*_)\]`'"]*(?=\s)|\n\s*\n|\n(?=\s*(?:\||[-*+]\s|\d+[.)]\s))/g
  let start = 0
  let end = text.length
  for (const m of text.matchAll(boundary)) {
    const at = m.index ?? 0
    if (at < index) start = at + m[0].length
    else {
      end = at
      break
    }
  }
  return [start, end]
}

export function sentenceAround(text: string, index: number): string {
  const [start, end] = sentenceBounds(text, index)
  return text.slice(start, end)
}

const proseOf = (text: string): string => text.replace(/`[^`]*`/g, ' code ').toLowerCase()

/**
 * Whether the citation at `index` is offered as history or a proposal: a
 * marker within a few words of it, inside its sentence, or a sentence that
 * opens with an imperative "Create". The path's own spelling never decides.
 */
export function citationReadsAsHistoryOrProposal(
  text: string,
  index: number,
  length: number
): boolean {
  const [start, end] = sentenceBounds(text, index)
  if (CITATION_IMPERATIVE_CREATE.test(proseOf(text.slice(start, end)))) return true
  const before = proseOf(text.slice(start, index)).split(/\s+/).filter(Boolean)
  const after = proseOf(text.slice(index + length, end))
    .split(/\s+/)
    .filter(Boolean)
  const window = [
    ...before.slice(-CITATION_CONTEXT_WORDS),
    ...after.slice(0, CITATION_CONTEXT_WORDS),
  ].join(' ')
  return CITATION_HISTORY.test(window) || CITATION_PROPOSAL.test(window)
}

export function checkBacktickedPathsExist(root: string): CheckResult {
  const failures: string[] = []
  const workspaces = workspaceDirs(root)
  const isGitignored = gitignoredMatcher(root)
  let checked = 0

  const judge = (doc: string, line: number, candidate: string): void => {
    if (isGitignored(candidate)) return
    checked++
    if (resolvesFrom(root, doc, candidate, workspaces)) return
    failures.push(
      `${doc}:${line} cites \`${candidate}\`, which does not exist. Fix the path, or, if the ` +
        'citation is history, say so beside it ("`x.ts` (since deleted)").'
    )
  }

  for (const doc of liveInstructionDocs(root)) {
    const source = checkedTextOf(read(root, doc))
    if (PLAN_DOC_STATUS.test(source.split('\n').slice(0, 20).join('\n'))) continue
    for (const block of splitMarkdownBlocks(source)) {
      for (const match of block.text.matchAll(/`([^`\n]+)`/g)) {
        const candidate = pathCandidate(match[1] as string)
        if (candidate === null) continue
        if (citationReadsAsHistoryOrProposal(block.text, match.index ?? 0, match[0].length)) {
          continue
        }
        judge(doc, lineOf(block, match.index ?? 0), candidate)
      }
    }
  }

  return { ok: `cited repo paths resolve (${checked} checked)`, failures }
}

// ─── scripts ────────────────────────────────────────────────────────────────

function scriptsOf(root: string, manifest: string): Set<string> {
  const path = join(root, manifest)
  if (!existsSync(path)) return new Set()
  const pkg = JSON.parse(readFileSync(path, 'utf-8')) as { scripts?: Record<string, string> }
  return new Set(Object.keys(pkg.scripts ?? {}))
}

/** Workspace manifest by package name, for `bun --filter <name> <script>`. */
function workspaceManifests(root: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const ws of workspaceDirs(root)) {
    const manifest = `${ws}/package.json`
    if (!existsSync(join(root, manifest))) continue
    const pkg = JSON.parse(read(root, manifest)) as { name?: string }
    out.set(pkg.name ?? ws.split('/')[1] ?? ws, manifest)
  }
  return out
}

/** A per-workspace doc may name its own workspace's scripts without `--filter`. */
const owningManifest = (doc: string): string | undefined =>
  doc.match(/^((?:apps|packages)\/[^/]+)\//)?.[1]?.concat('/package.json')

export function checkReferencedScripts(root: string): CheckResult {
  const failures: string[] = []
  const rootScripts = scriptsOf(root, 'package.json')
  const manifests = workspaceManifests(root)
  let checked = 0

  for (const doc of [...liveInstructionDocs(root), ...hookScripts(root)]) {
    const text = doc.endsWith('.md') ? checkedTextOf(read(root, doc)) : read(root, doc)
    const owner = owningManifest(doc)
    const localScripts = owner ? scriptsOf(root, owner) : new Set<string>()

    for (const m of text.matchAll(/\bbun run ([a-z][\w:-]*)/g)) {
      const script = m[1] as string
      checked++
      if (!rootScripts.has(script) && !localScripts.has(script)) {
        failures.push(
          `${doc} references \`bun run ${script}\`, which is not a script in the root ` +
            `package.json${owner ? ` or ${owner}` : ''}.`
        )
      }
    }

    // `bun run check data doc-drift`: the words after `check` are registry ids, but only
    // where the command visibly ends (a closing backtick or quote, or end of line / `#`).
    for (const m of text.matchAll(/\bbun run check((?: [a-z][a-z-]*)+)(?=[`'"]|[ \t]*(?:#|$))/gm)) {
      for (const id of (m[1] ?? '').trim().split(' ')) {
        checked++
        if (!CHECK_IDS.includes(id)) {
          failures.push(
            `${doc} references \`bun run check ${id}\`, but \`${id}\` is not a check id in ` +
              `tools/check.ts (known: ${CHECK_IDS.join(', ')}).`
          )
        }
      }
    }

    for (const m of text.matchAll(/\bbun --filter ([\w-]+) ([a-z][\w:-]*)/g)) {
      const [, workspace, script] = m as unknown as [string, string, string]
      checked++
      const manifest = manifests.get(workspace)
      if (manifest === undefined) {
        failures.push(`${doc} references \`bun --filter ${workspace}\`, which is no workspace.`)
      } else if (!scriptsOf(root, manifest).has(script)) {
        failures.push(
          `${doc} references \`bun --filter ${workspace} ${script}\`, which is not a script in ${manifest}.`
        )
      }
    }
  }

  return { ok: `documented bun scripts exist (${checked} references checked)`, failures }
}

// ─── claims ─────────────────────────────────────────────────────────────────

/** Claims the repo has retired, each with what is true instead. */
export const RETIRED_CLAIMS: [RegExp, string][] = [
  [/local-first/i, 'ITUN is account-gated: persistence requires an account (ADR-034)'],
  [/no auth\/backend|do not introduce a backend/i, 'Convex is the server of record (ADR-030)'],
  [/in-memory (?:backend|only)/i, 'signed out, ITUN is read-only: see apps/itun/CLAUDE.md'],
  [/\bEntityDisplay\b|\bDisplayCard\b/, 'the card shells are ReferenceEntityCard and Card'],
  [/prettier/i, 'Biome is the only formatter'],
  [/"bun test"/, 'the gate is `bun run test`'],
  [/docs\/rules\//, 'there is no rules digest: `bun run rules:extract`'],
  [/\/ship\b/, 'there is no /ship skill'],
]

/** Every doc an agent reads as instructions: live text only, so ADRs keep their history. */
const agentDocs = (root: string): string[] => [
  ...liveInstructionDocs(root),
  ...hookScripts(root),
  ...['.env.example'].filter((doc) => existsSync(join(root, doc))),
]

export function checkRetiredClaims(
  root: string,
  claims: [RegExp, string][] = RETIRED_CLAIMS
): CheckResult {
  const failures: string[] = []
  const docs = agentDocs(root)
  for (const doc of docs) {
    const text = doc.endsWith('.md') ? liveTextOf(read(root, doc)) : read(root, doc)
    for (const [index, line] of text.split('\n').entries()) {
      for (const [pattern, truth] of claims) {
        if (pattern.test(line)) {
          failures.push(`${doc}:${index + 1} matches ${pattern}, a retired claim: ${truth}.`)
        }
      }
    }
  }
  return { ok: `no agent doc repeats a retired claim (${docs.length} docs)`, failures }
}

// ─── links ──────────────────────────────────────────────────────────────────

/** Every git-tracked markdown file. */
function trackedMarkdown(root: string): string[] {
  const out = Bun.spawnSync(['git', 'ls-files', '-z', '--', '*.md'], { cwd: root })
  if (out.exitCode !== 0) throw new Error(`git ls-files failed: ${out.stderr.toString()}`)
  return out.stdout.toString().split('\0').filter(Boolean)
}

/** Inline `[text](target)` and reference-definition `[label]: target` links. */
const LINK_RE = /\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)|^\s*\[[^\]]+\]:\s*<?([^\s>]+)>?/gm

/** `text` with every `<…>` tag removed, repeated until none re-forms (`<a<b>>`). */
function stripTags(text: string): string {
  let out = text
  for (let prev = ''; prev !== out; ) {
    prev = out
    out = out.replace(/<[^>]+>/g, '')
  }
  return out
}

/**
 * A heading's anchor as GitHub renders it: link and code markup reduced to
 * their text, lowercased, every character but a letter, digit, space, `-` or
 * `_` dropped, and each space turned into `-` (so "A — B" is `a--b`).
 */
export function headingSlug(heading: string): string {
  return stripTags(heading.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/`([^`]*)`/g, '$1'))
    .replace(/[*~]/g, '')
    .replace(/(^|\s)_+|_+(?=\s|$)/g, '$1')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

/** Every heading anchor in a markdown source, fences skipped, repeats suffixed `-1`, `-2`. */
function headingSlugs(source: string): Set<string> {
  const slugs = new Set<string>()
  const seen = new Map<string, number>()
  let inFence = false
  for (const line of source.split('\n')) {
    if (/^\s{0,3}(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    const heading = inFence ? null : line.match(/^\s{0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/)
    if (!heading) continue
    const base = headingSlug(heading[1] as string)
    const repeat = seen.get(base) ?? 0
    seen.set(base, repeat + 1)
    slugs.add(repeat === 0 ? base : `${base}-${repeat}`)
  }
  return slugs
}

export function checkMarkdownLinks(
  root: string,
  docs: string[] = trackedMarkdown(root)
): CheckResult {
  const failures: string[] = []
  const isGitignored = gitignoredMatcher(root)
  const slugCache = new Map<string, Set<string>>()
  const slugsOf = (file: string): Set<string> => {
    let slugs = slugCache.get(file)
    if (slugs === undefined) {
      slugs = headingSlugs(read(root, file))
      slugCache.set(file, slugs)
    }
    return slugs
  }
  let checked = 0
  for (const doc of docs) {
    for (const block of splitMarkdownBlocks(read(root, doc))) {
      // A link inside a code span is an example, not a link.
      const text = block.text.replace(/`[^`\n]*`/g, (span) => ' '.repeat(span.length))
      for (const m of text.matchAll(LINK_RE)) {
        const target = (m[1] ?? m[2]) as string
        if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue
        const at = `${doc}:${lineOf(block, m.index ?? 0)}`
        const path = decodeURIComponent(target.replace(/[#?].*$/, ''))
        const resolved =
          path === '' ? doc : path.startsWith('/') ? path.slice(1) : join(dirname(doc), path)
        if (isGitignored(resolved)) continue
        checked++
        if (!existsSync(join(root, resolved))) {
          failures.push(`${at} links to \`${target}\`, which does not exist.`)
          continue
        }
        const fragment = target.match(/#([^?]*)$/)?.[1]
        if (fragment === undefined || fragment === '' || !resolved.endsWith('.md')) continue
        if (!slugsOf(resolved).has(decodeURIComponent(fragment))) {
          failures.push(
            `${at} links to \`${target}\`, whose #${fragment} is no heading in ${resolved}.`
          )
        }
      }
    }
  }
  return {
    ok: `relative markdown links and their anchors resolve (${checked} in ${docs.length} files)`,
    failures,
  }
}

// ─── decisions ──────────────────────────────────────────────────────────────

/** The one file the ADRs live in, under its `# Decisions` heading. */
const DECISIONS_DOC = 'docs/ARCHITECTURE.md'

/** The ADR count when docs/adrs/ was folded into DECISIONS_DOC: none may go missing. */
const ADR_FLOOR = 39

const adrId = (n: number): string => `ADR-${String(n).padStart(3, '0')}`

/** "Amends [ADR-022]", "**Supersedes ADR-004**", "reverses ADR-019": one ADR acting on another. */
const ACTS_ON = /\b(amends|supersedes|reverses|replaces)\b[\s*_]*\[?ADR-(\d{3})\b/gi

/** "**Also amends:**": a lead-in whose list items below it each open on the ADR acted on. */
const ACTS_ON_LIST = /\b(amends|supersedes|reverses|replaces)\b[^\n]*:[\s*_]*$/i

/** "- [ADR-030](#adr-030) §5: …": the ADR a list item under an ACTS_ON_LIST lead-in names first. */
const LIST_ITEM_ADR = /^\s*[-*+]\s+[*_]*\[?ADR-(\d{3})\b/

/** Every (verb, target ADR) a Status states, inline or as a list under a lead-in. */
function actsOn(status: string): { verb: string; target: number }[] {
  const acts = [...status.matchAll(ACTS_ON)].map((m) => ({
    verb: (m[1] as string).toLowerCase(),
    target: Number(m[2]),
  }))
  let listVerb: string | undefined
  for (const line of status.split('\n')) {
    const leadIn = line.match(ACTS_ON_LIST)
    if (leadIn) {
      listVerb = (leadIn[1] as string).toLowerCase()
      continue
    }
    if (listVerb === undefined) continue
    // The list runs while its lines are items or their indented continuations.
    if (!/^(\s+\S|[-*+]\s)/.test(line)) {
      listVerb = undefined
      continue
    }
    const item = line.match(LIST_ITEM_ADR)
    if (item) acts.push({ verb: listVerb, target: Number(item[1]) })
  }
  return acts
}

/**
 * An ADR whose Status amends, supersedes or reverses another must be named in
 * that other ADR's Status, which is where a reader of it looks first.
 */
export function missingBackReferences(source: string): string[] {
  const sections = adrSections(source)
  const status = new Map(sections.map((section) => [section.n, statusOf(section)]))
  const failures: string[] = []
  for (const section of sections) {
    const self = adrId(section.n)
    for (const { verb, target } of actsOn(status.get(section.n) ?? '')) {
      if (target === section.n || !status.has(target)) continue
      if (status.get(target)?.includes(self)) continue
      failures.push(
        `${DECISIONS_DOC}: ${self} ${verb} ${adrId(target)}, but ` +
          `${adrId(target)}'s Status does not name ${self}. Add a dated line there ` +
          `("**Amended by [${self}](#${self.toLowerCase()})** …").`
      )
    }
  }
  return failures
}

export function checkDecisions(root: string, floor: number = ADR_FLOOR): CheckResult {
  const failures: string[] = []
  if (existsSync(join(root, 'docs/adrs'))) {
    failures.push(
      `docs/adrs/ exists again. An ADR is a \`## ADR-NNN\` section under \`# Decisions\` in ${DECISIONS_DOC}: move it there.`
    )
  }
  if (!existsSync(join(root, DECISIONS_DOC))) {
    failures.push(`${DECISIONS_DOC}, which holds the ADRs, does not exist.`)
    return { ok: '', failures }
  }
  const count = new Map<number, number>()
  let inFence = false
  let inDecisions = false
  for (const [index, line] of read(root, DECISIONS_DOC).split('\n').entries()) {
    if (/^\s{0,3}(```|~~~)/.test(line)) inFence = !inFence
    if (inFence) continue
    if (DECISIONS_HEADING.test(line)) inDecisions = true
    const adr = line.match(/^##\s+ADR-(\d+)/)
    if (!adr) continue
    const at = `${DECISIONS_DOC}:${index + 1}`
    if (!/^## ADR-\d{3}$/.test(line)) {
      failures.push(
        `${at} heads an ADR "${line}". The heading is bare (\`## ADR-NNN\`); the title goes on the line below.`
      )
    } else if (!inDecisions) {
      failures.push(`${at} is an ADR above \`# Decisions\`. Move it into that section.`)
    }
    const n = Number(adr[1])
    count.set(n, (count.get(n) ?? 0) + 1)
  }
  const highest = Math.max(floor, ...count.keys())
  for (let n = 1; n <= highest; n++) {
    const seen = count.get(n) ?? 0
    if (seen === 0)
      failures.push(
        `${DECISIONS_DOC} has no \`## ${adrId(n)}\`. ADRs are never deleted or renumbered: restore it.`
      )
    if (seen > 1)
      failures.push(
        `${DECISIONS_DOC} heads \`## ${adrId(n)}\` ${seen} times. Give the new decision the next number.`
      )
  }
  failures.push(...missingBackReferences(read(root, DECISIONS_DOC)))
  return {
    ok: `${count.size} ADRs, ${adrId(1)} to ${adrId(highest)}, once each under # Decisions in ${DECISIONS_DOC}, every amendment named in the Status it amends`,
    failures,
  }
}

// ─── size ───────────────────────────────────────────────────────────────────

const CLAUDE_MD_BUDGET = 8_000
const RULE_BUDGET = 4_000

/**
 * Files over budget when the budget landed, held at that size until they are
 * cut. Lower an entry when its file shrinks; delete it once under budget.
 */
const OVER_BUDGET: Record<string, number> = {
  'apps/itun/CLAUDE.md': 13_154,
  'apps/srd/CLAUDE.md': 11_748,
  'CLAUDE.md': 12_065,
  'packages/component-lib/CLAUDE.md': 15_948,
  'packages/salvageunion-reference/CLAUDE.md': 9_333,
}

/**
 * A doc that replaced a folder of docs, and the budget that keeps its live
 * text (`liveTextOf`: everything above `# Decisions`) terse. The ADRs below
 * are an append-only record and are not counted. Raise one only on purpose,
 * saying why in the PR.
 */
const COLLAPSED_DOCS: Record<string, number> = {
  // The architecture sections as measured when the budget moved to live text.
  'docs/ARCHITECTURE.md': 55_373,
}

export function checkDocSizes(
  root: string,
  overBudget: Record<string, number> = OVER_BUDGET,
  collapsed: Record<string, number> = COLLAPSED_DOCS
): CheckResult {
  const failures: string[] = []
  const claudeMds = ['CLAUDE.md', ...workspaceDirs(root).map((ws) => `${ws}/CLAUDE.md`)].filter(
    (doc) => existsSync(join(root, doc))
  )
  const rules = markdownIn(root, '.claude/rules')
  const budgeted: [string, number][] = [
    ...claudeMds.map((doc): [string, number] => [doc, CLAUDE_MD_BUDGET]),
    ...rules.map((doc): [string, number] => [doc, RULE_BUDGET]),
    ...markdownIn(root, '.claude/agents').map((doc): [string, number] => [doc, CLAUDE_MD_BUDGET]),
  ]
  for (const [doc, budget] of Object.entries(collapsed)) {
    if (existsSync(join(root, doc))) budgeted.push([doc, budget])
    else failures.push(`COLLAPSED_DOCS names ${doc}, which does not exist. Remove the entry.`)
  }
  for (const [doc, base] of budgeted) {
    const budget = overBudget[doc] ?? base
    const text = doc in collapsed ? liveTextOf(read(root, doc)) : read(root, doc)
    const size = [...text].length
    if (size > budget) {
      failures.push(
        `${doc} is ${size} characters, over its ${budget}-character budget. Cut it: no rosters, ` +
          'no history, no restating what a check or --list already says.'
      )
    }
  }
  for (const doc of Object.keys(overBudget)) {
    if (!budgeted.some(([d]) => d === doc)) {
      failures.push(`OVER_BUDGET names ${doc}, which is not a budgeted file. Remove the entry.`)
    }
  }
  return { ok: `${budgeted.length} agent docs within their size budgets`, failures }
}

// ─── runner ─────────────────────────────────────────────────────────────────

const CHECKS = [
  checkBacktickedPathsExist,
  checkReferencedScripts,
  (root: string) => checkRetiredClaims(root),
  (root: string) => checkMarkdownLinks(root),
  (root: string) => checkDecisions(root),
  (root: string) => checkDocSizes(root),
] as const

if (import.meta.main) {
  // A collapsed corpus (a renamed doc directory) would pass every check. The floor is
  // floor(0.65 × N) for N = 21, the count once the workspace READMEs, CONTRIBUTING.md
  // and the done plans in docs/architecture/ were cut (#1149).
  const liveDocs = liveInstructionDocs(repoRoot)
  assertScanFloor('doc-drift (live-instruction docs)', liveDocs.length, 13)
  console.log(`  (${liveDocs.length} live-instruction docs scanned)`)

  const failures: string[] = []
  for (const check of CHECKS) {
    const result = check(repoRoot)
    if (result.failures.length === 0) console.log(`✓ ${result.ok}`)
    failures.push(...result.failures)
  }
  for (const message of failures) console.error(`✗ ${message}`)
  if (failures.length > 0) {
    console.error(`\n${failures.length} doc-drift failure(s)`)
    process.exit(1)
  }
}
