#!/usr/bin/env bun
/**
 * Doc drift — `bun run check doc-drift`. Eleven checks, each asking whether
 * what a doc, or a comment, tells a reader is still true:
 *
 *   paths    every backticked repo path in a live-instruction doc or a
 *            Claude hook's text exists, unless the words beside it mark it as
 *            history or a proposal.
 *   scripts  every `bun run <script>`, `bun --filter <ws> <script>` and
 *            `bun run check <id>` in that same text, or in a Claude hook,
 *            names a real script or check id.
 *   fixes    every repo path and bun command in a `tools/check.ts` fix hint
 *            (printed under a failed gate) exists.
 *   claims   no agent doc (the docs above, the hooks and `.env.example`;
 *            the ADR entries excepted, which record what was retired) repeats
 *            a claim the repo has retired (`RETIRED_CLAIMS`).
 *   decisions every ADR is entry N of the numbered list under `## Decisions`
 *            in docs/ARCHITECTURE.md (`N. **ADR-NNN Title**`), none missing or
 *            repeated, docs/adrs/ stays gone, and an entry that amends,
 *            supersedes or reverses another is named in that other entry.
 *            An ADR whose full text is kept (the ones code cites by §) is
 *            one `docs/adr/NNN-slug.md` with `status` front-matter and a
 *            `# ADR-NNN: Title`, linked from entry N's headline.
 *   shape    a terse doc (`TERSE_DOCS`) is numbered entries under `## `
 *            sections: a bold headline, then at most two lines.
 *   links    every relative markdown link in a tracked `.md` file resolves,
 *            and its `#fragment`, into a `.md` file or the same file, names a
 *            heading or an `<a id>` anchor there.
 *   areas    every entry under `## Areas` in docs/ARCHITECTURE.md carries one
 *            `<a id="slug"></a>` anchor, and every tracked file cites an Area
 *            by that slug: no bare "Areas N" (the numbers shift whenever an
 *            Area is inserted), and every `ARCHITECTURE.md#fragment` names an
 *            anchor there other than the whole-section `#areas`.
 *   size     root and per-directory CLAUDE.md files stay under 8,000
 *            characters and `.claude/rules/*.md` under 4,000. A CLAUDE.md
 *            counts the files it imports by an `@path` line (the root's
 *            `@AGENTS.md`), since they load with it.
 *            They load into every agent session in scope, so growth costs
 *            every session. A collapsed doc (`COLLAPSED_DOCS`) holds its own
 *            budget: terse is the point.
 *   load     each named session profile (`SESSION_PROFILES`: srd,
 *            itun+component-lib, bot) totals what it loads (the root
 *            CLAUDE.md and its imports, each CLAUDE.md under its directories,
 *            every rule whose `paths:` match a file there, and the docs its
 *            text says to read first), held to a ratchet (`SESSION_CEILINGS`).
 *   history  no comment in tracked code under apps/, packages/ or tools/
 *            narrates history (`gates/lib/commentHistory`'s phrases, at zero).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { checkCommentHistory } from 'gates/lib/commentHistory'
import { assertScanFloor } from 'gates/lib/scanFloor'
import type { SessionProfile } from 'gates/lib/sessionLoad'
import { checkSessionLoad, gitignoredMatcher, importsOf, markdownIn } from 'gates/lib/sessionLoad'
import { CHECK_IDS, CHECKS as GATES } from './check'

const repoRoot = join(import.meta.dir, '..')

/** The outcome of one check: `failures` empty means it passed. */
export type CheckResult = { ok: string; failures: string[] }

const read = (root: string, relPath: string): string => readFileSync(join(root, relPath), 'utf-8')

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
const LIVE_INSTRUCTION_DOC_DIRS = ['.claude/rules', '.claude/skills', 'docs/architecture']

function liveInstructionDocs(root: string): string[] {
  return [
    'AGENTS.md',
    'CLAUDE.md',
    'README.md',
    'docs/ARCHITECTURE.md',
    ...workspaceDirs(root).map((ws) => `${ws}/CLAUDE.md`),
    ...LIVE_INSTRUCTION_DOC_DIRS.flatMap((dir) => markdownIn(root, dir)),
  ].filter((doc) => existsSync(join(root, doc)))
}

const hookScripts = (root: string): string[] => filesIn(root, '.claude/hooks', '.sh')

/** A hook script read as prose: comment markers dropped, so its comments split into sentences. */
const hookProse = (source: string): string => source.replace(/^[ \t]*#+[ \t]?/gm, '')

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
const DECISIONS_HEADING = /^## Decisions$/m

/**
 * A markdown doc up to its `## Decisions` heading: the part that describes the
 * code as it is now. The ADR entries below also record what was retired.
 */
function liveTextOf(source: string): string {
  const at = source.search(DECISIONS_HEADING)
  return at === -1 ? source : source.slice(0, at)
}

/** One numbered list entry: its number, the ADR it names (if any), its lines and their 0-based indices. */
type Entry = { n: number; adr: number | undefined; start: number; lines: string[]; at: number[] }

/** An entry's opening line: `12. **ADR-012 Title**` or `3. **Headline**`. */
const ENTRY_START = /^(\d+)\.\s+\*\*(?:ADR-(\d+)\b)?/

/** The numbered entries of each `## ` section, each with its continuation lines. */
function entriesOf(source: string): (Entry & { section: string })[] {
  const entries: (Entry & { section: string })[] = []
  let section = ''
  let inFence = false
  for (const [i, line] of source.split('\n').entries()) {
    if (/^\s{0,3}(```|~~~)/.test(line)) inFence = !inFence
    if (inFence) continue
    if (/^#{1,6}\s/.test(line)) {
      section = line.replace(/^#+\s+/, '')
      entries.push({ n: Number.NaN, adr: undefined, start: i, lines: [], at: [], section })
      continue
    }
    const m = line.match(ENTRY_START)
    if (m) {
      const adr = m[2] === undefined ? undefined : Number(m[2])
      entries.push({ n: Number(m[1]), adr, start: i, lines: [line], at: [i], section })
    } else if (line.trim() !== '') {
      entries.at(-1)?.lines.push(line)
      entries.at(-1)?.at.push(i)
    }
  }
  return entries.filter((entry) => !Number.isNaN(entry.n))
}

/** The ADR entries under `## Decisions`. */
const adrEntries = (source: string) =>
  entriesOf(source).filter((entry) => entry.section === 'Decisions' && entry.adr !== undefined)

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

  const sources = [
    ...liveInstructionDocs(root).map((doc) => [doc, read(root, doc)] as const),
    ...hookScripts(root).map((hook) => [hook, hookProse(read(root, hook))] as const),
  ]
  for (const [doc, source] of sources) {
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

/** What a bun command reference is judged against. */
type ScriptContext = {
  rootScripts: Set<string>
  manifests: Map<string, string>
  scriptsIn: (manifest: string) => Set<string>
}

function scriptContext(root: string): ScriptContext {
  return {
    rootScripts: scriptsOf(root, 'package.json'),
    manifests: workspaceManifests(root),
    scriptsIn: (manifest) => scriptsOf(root, manifest),
  }
}

/**
 * Failures for each `bun run <script>`, `bun run check <id>` and
 * `bun --filter <ws> <script>` in `text`, with the number of references judged.
 * `owner` is the manifest whose scripts `text` may name without `--filter`.
 */
function scriptReferenceFailures(
  label: string,
  text: string,
  ctx: ScriptContext,
  owner: string | undefined
): { failures: string[]; checked: number } {
  const failures: string[] = []
  const localScripts = owner ? ctx.scriptsIn(owner) : new Set<string>()
  let checked = 0

  for (const m of text.matchAll(/\bbun run ([a-z][\w:-]*)/g)) {
    const script = m[1] as string
    checked++
    if (!ctx.rootScripts.has(script) && !localScripts.has(script)) {
      failures.push(
        `${label} references \`bun run ${script}\`, which is not a script in the root ` +
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
          `${label} references \`bun run check ${id}\`, but \`${id}\` is not a check id in ` +
            `tools/check.ts (known: ${CHECK_IDS.join(', ')}).`
        )
      }
    }
  }

  for (const m of text.matchAll(/\bbun --filter ([\w-]+) ([a-z][\w:-]*)/g)) {
    const [, workspace, script] = m as unknown as [string, string, string]
    checked++
    const manifest = ctx.manifests.get(workspace)
    if (manifest === undefined) {
      failures.push(`${label} references \`bun --filter ${workspace}\`, which is no workspace.`)
    } else if (!ctx.scriptsIn(manifest).has(script)) {
      failures.push(
        `${label} references \`bun --filter ${workspace} ${script}\`, which is not a script in ${manifest}.`
      )
    }
  }

  return { failures, checked }
}

export function checkReferencedScripts(root: string): CheckResult {
  const failures: string[] = []
  const ctx = scriptContext(root)
  let checked = 0

  for (const doc of [...liveInstructionDocs(root), ...hookScripts(root)]) {
    const found = scriptReferenceFailures(doc, read(root, doc), ctx, owningManifest(doc))
    failures.push(...found.failures)
    checked += found.checked
  }

  return { ok: `documented bun scripts exist (${checked} references checked)`, failures }
}

// ─── fixes ──────────────────────────────────────────────────────────────────

/** A gate's one-line fix hint, as the `tools/check.ts` registry prints it under a failure. */
export type FixHint = { id: string; fix: string }

const REGISTRY_FIX_HINTS: FixHint[] = GATES.map(({ id, fix }) => ({ id, fix }))

/** A repo-rooted path in running text, backticked or bare: `tools/x.ts`, docs/A.md#anchor. */
const FIX_HINT_PATH = new RegExp(
  `(?<![\\w./-])((?:${REPO_PATH_ROOTS.map((r) => r.replace('.', '\\.')).join('|')})/[\\w./-]*[\\w/])`,
  'g'
)

/** A path template, not a path: `docs/adr/NNN-slug.md`. */
const FIX_HINT_TEMPLATE = /\bN{3,}\b/

/**
 * The fix hints are instructions too, read at the worst moment: under a red
 * gate. Every repo path one names must exist, and every bun command name a
 * real script or check id.
 */
export function checkFixHints(root: string, hints: FixHint[] = REGISTRY_FIX_HINTS): CheckResult {
  const failures: string[] = []
  const workspaces = workspaceDirs(root)
  const ctx = scriptContext(root)
  let checked = 0

  for (const { id, fix } of hints) {
    const label = `tools/check.ts fix hint for \`${id}\``
    for (const m of fix.matchAll(FIX_HINT_PATH)) {
      const candidate = (m[1] as string).replace(/\/$/, '')
      if (FIX_HINT_TEMPLATE.test(candidate)) continue
      checked++
      if (!resolvesFrom(root, 'tools/check.ts', candidate, workspaces)) {
        failures.push(`${label} names ${candidate}, which does not exist. Fix the hint.`)
      }
    }
    const found = scriptReferenceFailures(label, fix, ctx, undefined)
    failures.push(...found.failures)
    checked += found.checked
  }

  return { ok: `check.ts fix hints name real paths and scripts (${checked} checked)`, failures }
}

// ─── claims ─────────────────────────────────────────────────────────────────

/** Claims the repo has retired, each with what is true instead. */
const RETIRED_CLAIMS: [RegExp, string][] = [
  [/local-first/i, 'ITUN is account-gated: persistence requires an account (ADR-034)'],
  [/no auth\/backend|do not introduce a backend/i, 'Convex is the server of record (ADR-030)'],
  [
    /in-memory (?:backend|only)/i,
    'signed out, ITUN is read-only: see .claude/rules/itun-data-access.md',
  ],
  [/\bEntityDisplay\b|\bDisplayCard\b/, 'the card shells are ReferenceEntityCard and Card'],
  [/prettier/i, 'Biome is the only formatter'],
  [/"bun test"/, 'the gate is `bun run test`'],
  [/docs\/rules\//, 'there is no rules digest: `bun run rules:extract`'],
  [/\/ship\b/, 'there is no /ship skill'],
  [
    /anonymous (?:play|visitors?)[^.\n]*first-class|first-class for \*?building/i,
    'signed out, ITUN is read-only; building needs an account (ADR-034)',
  ],
  [/\bin[- ]memory (?:work|play)\b/i, 'signed out holds no work: it is read-only (#1117)'],
  [/\bSolo (?:build|client)\b|isConvexConfigured/, 'every ITUN build has a Convex deployment'],
  [/salvage-tolerant/i, 'cache reads are strict: an unreadable row is skipped and refilled'],
  [
    /`gh` (?:CLI )?is (?:usually )?absent|\(no `gh`/i,
    'cloud sessions have `gh`, REST only: `gh pr`/`gh issue` get 403 (docs/ARCHITECTURE.md, Cloud sessions)',
  ],
]

/** Every doc an agent reads as instructions: live text only, so ADR entries keep their history. */
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

/** An anchor GitHub keeps in rendered markdown: `<a id="slug">` or `<a name="slug">`. */
const HTML_ANCHOR = /<a\s+(?:id|name)="([^"]+)"/g

/**
 * Every anchor in a markdown source, fences skipped: each heading's slug,
 * repeats suffixed `-1`, `-2`, and each `<a id>` / `<a name>`.
 */
function headingSlugs(source: string): Set<string> {
  const slugs = new Set<string>()
  const seen = new Map<string, number>()
  let inFence = false
  for (const line of source.split('\n')) {
    if (/^\s{0,3}(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    for (const anchor of line.replace(/`[^`]*`/g, '').matchAll(HTML_ANCHOR)) {
      slugs.add(anchor[1] as string)
    }
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/)
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
            `${at} links to \`${target}\`, whose #${fragment} is no heading or anchor in ${resolved}.`
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

// \u2500\u2500\u2500 areas \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

/** The doc whose `## Areas` entries the rest of the repo cites. */
const AREAS_DOC = 'docs/ARCHITECTURE.md'

/** An Area's anchor, closing its headline line: ` <a id="slug"></a>`, the slug lowercase and hyphenated. */
const AREA_ANCHOR = / <a id="([a-z0-9]+(?:-[a-z0-9]+)*)"><\/a>$/

/** "Areas 17", "Area 9\u201312": an Area cited by a number, which shifts whenever one is inserted. */
const AREA_NUMBER = /\bAreas?\s+\d+/g

/** `ARCHITECTURE.md#fragment`, as a link target or a path in a comment. */
const AREAS_DOC_FRAGMENT = /\bARCHITECTURE\.md#([\w%-]+)/g

/** `ARCHITECTURE.md ("Title")`, `ARCHITECTURE.md, "Title"` or `ARCHITECTURE.md § Title`: a title nothing resolves. */
const AREAS_DOC_TITLE = /\bARCHITECTURE\.md(?: \("|, "| §)/g

/** The checker and its tests, whose fixtures cite fragments that do not exist on purpose. */
const AREA_CITATION_EXEMPT = new Set([
  'tools/check-doc-drift.ts',
  'tools/__tests__/check-doc-drift.test.ts',
])

/** Every tracked text file that cites `ARCHITECTURE.md#…`, a section by title, or an Area by number. */
function filesCitingAreas(root: string): string[] {
  const out = Bun.spawnSync(
    [
      'git',
      'grep',
      '-lIE',
      '-e',
      'ARCHITECTURE\\.md#',
      '-e',
      'ARCHITECTURE\\.md( \\("|, "| §)',
      '-e',
      'Areas? +[0-9]',
    ],
    { cwd: root }
  )
  // git grep exits 1 when nothing matches.
  if (out.exitCode > 1) throw new Error(`git grep failed: ${out.stderr.toString()}`)
  return out.stdout
    .toString()
    .split('\n')
    .filter((file) => file !== '' && !AREA_CITATION_EXEMPT.has(file))
}

export function checkAreaCitations(
  root: string,
  files: string[] = filesCitingAreas(root)
): CheckResult {
  const failures: string[] = []
  const source = read(root, AREAS_DOC)
  const areas = entriesOf(source).filter((entry) => entry.section === 'Areas')
  if (areas.length === 0) failures.push(`${AREAS_DOC} has no numbered entries under \`## Areas\`.`)
  const seen = new Set<string>()
  for (const entry of areas) {
    const at = `${AREAS_DOC}:${entry.start + 1}`
    const slug = entry.lines[0]?.match(AREA_ANCHOR)?.[1]
    if (slug === undefined) {
      failures.push(
        `${at} is an Area with no anchor. End its headline line with \` <a id="slug"></a>\` (lowercase, hyphenated).`
      )
    } else if (seen.has(slug)) {
      failures.push(`${at} repeats the anchor #${slug}. Give each Area its own.`)
    } else {
      seen.add(slug)
    }
  }
  const anchors = headingSlugs(source)
  let cited = 0
  for (const file of files) {
    for (const [index, line] of read(root, file).split('\n').entries()) {
      const at = `${file}:${index + 1}`
      for (const m of line.matchAll(AREA_NUMBER)) {
        failures.push(
          `${at} cites "${m[0]}" by number, which shifts when an Area is inserted. Cite its anchor: \`ARCHITECTURE.md#slug\`.`
        )
      }
      for (const m of line.matchAll(AREAS_DOC_TITLE)) {
        failures.push(
          `${at} cites ARCHITECTURE.md by a section title (\`${m[0].slice(m[0].indexOf(' '))}\`), which nothing resolves. Cite its anchor: \`ARCHITECTURE.md#slug\`.`
        )
      }
      for (const m of line.matchAll(AREAS_DOC_FRAGMENT)) {
        cited++
        const fragment = decodeURIComponent(m[1] as string)
        if (fragment === 'areas') {
          failures.push(
            `${at} cites ARCHITECTURE.md#areas, the whole section. Cite the Area's own anchor.`
          )
        } else if (!anchors.has(fragment)) {
          failures.push(
            `${at} cites ARCHITECTURE.md#${fragment}, which is no heading or anchor in ${AREAS_DOC}.`
          )
        }
      }
    }
  }
  return {
    ok: `${areas.length} Areas anchored; ${cited} ARCHITECTURE.md# citations in ${files.length} files resolve`,
    failures,
  }
}

// \u2500\u2500\u2500 decisions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

/** The one file the ADRs live in, as the numbered entries under its `## Decisions`. */
const DECISIONS_DOC = 'docs/ARCHITECTURE.md'

/** The ADR count when the ADRs became one-entry summaries: none may go missing. */
const ADR_FLOOR = 45

const adrId = (n: number): string => `ADR-${String(n).padStart(3, '0')}`

/** "Amends ADR-022", "Supersedes ADR-004", "reverses ADR-019": one ADR acting on another. */
const ACTS_ON = /\b(amends|supersedes|reverses|replaces)\b[\s*_]*\[?ADR-(\d{3})\b/gi

/**
 * An ADR entry that amends, supersedes or reverses another must be named in
 * that other entry, which is where a reader of it looks first.
 */
function missingBackReferences(source: string): string[] {
  const text = new Map(adrEntries(source).map((entry) => [entry.adr, entry.lines.join('\n')]))
  const failures: string[] = []
  for (const [n, body] of text) {
    const self = adrId(n as number)
    for (const m of body.matchAll(ACTS_ON)) {
      const target = Number(m[2])
      if (target === n || !text.has(target) || text.get(target)?.includes(self)) continue
      failures.push(
        `${DECISIONS_DOC}: ${self} ${(m[1] as string).toLowerCase()} ${adrId(target)}, but ` +
          `${adrId(target)}'s entry does not name ${self}. Add "amended by ${self}" there.`
      )
    }
  }
  return failures
}

/** Where an ADR's full text lives when it is kept: `docs/adr/NNN-slug.md`. */
const ADR_DIR = 'docs/adr'
const ADR_FILE = /^(\d{3})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/
const ADR_STATUSES = ['proposed', 'accepted', 'superseded-in-part']

/** Every way a `docs/adr/` file breaks the layout or loses its entry's link. */
function adrFileFailures(root: string, source: string): { count: number; failures: string[] } {
  const failures: string[] = []
  const dir = join(root, ADR_DIR)
  const names = existsSync(dir) ? readdirSync(dir).sort() : []
  const entries = new Map(adrEntries(source).map((entry) => [entry.adr, entry]))
  const seen = new Map<number, string>()
  for (const name of names) {
    const doc = `${ADR_DIR}/${name}`
    const m = name.match(ADR_FILE)
    if (!m) {
      failures.push(`${doc} is not an ADR file. Name it \`NNN-slug.md\` (lowercase, hyphenated).`)
      continue
    }
    const n = Number(m[1])
    const other = seen.get(n)
    if (other) failures.push(`${adrId(n)} has two files, ${other} and ${doc}. Keep one.`)
    seen.set(n, doc)
    const entry = entries.get(n)
    if (entry === undefined) {
      failures.push(`${doc} has no ${adrId(n)} entry under \`## Decisions\` in ${DECISIONS_DOC}.`)
    } else if (!(entry.lines[0] ?? '').includes(`](adr/${name})`)) {
      failures.push(
        `${DECISIONS_DOC}:${entry.start + 1} is ${adrId(n)}, whose full text is ${doc}: link it from the headline (\`· [full text](adr/${name})\`).`
      )
    }
    const lines = read(root, doc).split('\n')
    const close = lines[0] === '---' ? lines.indexOf('---', 1) : -1
    const status = lines.slice(1, close).find((line) => line.startsWith('status:'))
    const value = status?.slice('status:'.length).trim() ?? ''
    if (close === -1 || !ADR_STATUSES.includes(value)) {
      failures.push(
        `${doc} needs front-matter \`---\` / \`status: <${ADR_STATUSES.join(' | ')}>\` / \`---\` (a superseded ADR keeps only its entry).`
      )
    }
    const title = lines.slice(close + 1).find((line) => line.trim() !== '') ?? ''
    if (!title.startsWith(`# ${adrId(n)}: `)) {
      failures.push(
        `${doc} opens on "${title}"; its first line after the front-matter is \`# ${adrId(n)}: Title\`.`
      )
    }
  }
  return { count: seen.size, failures }
}

export function checkDecisions(root: string, floor: number = ADR_FLOOR): CheckResult {
  const failures: string[] = []
  if (existsSync(join(root, 'docs/adrs'))) {
    failures.push(
      `docs/adrs/ exists again. An ADR is an entry under \`## Decisions\` in ${DECISIONS_DOC}: move it there.`
    )
  }
  if (!existsSync(join(root, DECISIONS_DOC))) {
    failures.push(`${DECISIONS_DOC}, which holds the ADRs, does not exist.`)
    return { ok: '', failures }
  }
  const source = read(root, DECISIONS_DOC)
  for (const [index, line] of source.split('\n').entries()) {
    if (/^#{1,6}\s+ADR-\d/.test(line)) {
      failures.push(
        `${DECISIONS_DOC}:${index + 1} heads an ADR. An ADR is a numbered entry under \`## Decisions\`, not a heading.`
      )
    }
  }
  const count = new Map<number, number>()
  for (const entry of entriesOf(source)) {
    if (entry.adr === undefined) continue
    const at = `${DECISIONS_DOC}:${entry.start + 1}`
    if (entry.section !== 'Decisions') {
      failures.push(`${at} is an ADR entry outside \`## Decisions\`. Move it there.`)
    } else if (entry.n !== entry.adr) {
      failures.push(`${at} numbers ${adrId(entry.adr)} as entry ${entry.n}. Entry N is ADR-N.`)
    }
    count.set(entry.adr, (count.get(entry.adr) ?? 0) + 1)
  }
  const highest = Math.max(floor, ...count.keys())
  for (let n = 1; n <= highest; n++) {
    const seen = count.get(n) ?? 0
    if (seen === 0)
      failures.push(
        `${DECISIONS_DOC} has no ${adrId(n)} entry. ADRs are never deleted or renumbered: restore it.`
      )
    if (seen > 1)
      failures.push(
        `${DECISIONS_DOC} lists ${adrId(n)} ${seen} times. Give the new decision the next number.`
      )
  }
  failures.push(...missingBackReferences(source))
  const files = adrFileFailures(root, source)
  failures.push(...files.failures)
  return {
    ok: `${count.size} ADRs, ${adrId(1)} to ${adrId(highest)}, once each under ## Decisions in ${DECISIONS_DOC}, every amendment named in the entry it amends; ${files.count} full-text ADR files, each linked from its entry`,
    failures,
  }
}

// ─── shape ──────────────────────────────────────────────────────────────────

/** Docs that are numbered entries only: a bold headline, then at most two lines. */
const TERSE_DOCS = ['docs/ARCHITECTURE.md']

/** Description lines an entry may carry under its headline. */
const ENTRY_LINES = 2

export function checkTerseShape(root: string, docs: string[] = TERSE_DOCS): CheckResult {
  const failures: string[] = []
  let entries = 0
  for (const doc of docs) {
    if (!existsSync(join(root, doc))) {
      failures.push(`TERSE_DOCS names ${doc}, which does not exist. Remove the entry.`)
      continue
    }
    const source = read(root, doc)
    for (const entry of entriesOf(source)) {
      entries++
      const at = `${doc}:${entry.start + 1}`
      const extra = entry.lines.slice(1)
      if (extra.length > ENTRY_LINES) {
        failures.push(
          `${at} runs ${extra.length} lines under its headline; the limit is ${ENTRY_LINES}. Cut it: history is in git.`
        )
      }
      const stray = extra.findIndex((line) => !/^\s+\S/.test(line))
      if (stray !== -1) {
        failures.push(
          `${doc}:${(entry.at[stray + 1] as number) + 1} is prose between entries. Fold it into an entry or cut it.`
        )
      }
    }
  }
  return {
    ok: `${entries} entries in ${docs.length} terse doc(s) within ${ENTRY_LINES} lines`,
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
  'apps/itun/CLAUDE.md': 11_682,
  /** With its `@AGENTS.md` import. */
  'CLAUDE.md': 10_167,
}

/**
 * Context docs collapsed to terse lists, each held near its collapsed size so
 * prose cannot creep back. Raise one only on purpose, saying why in the PR.
 */
const COLLAPSED_DOCS: Record<string, number> = {
  'apps/srd/ssg/DESIGN.md': 5_400,
  'docs/ARCHITECTURE.md': 20_500,
  'docs/README.md': 2_600,
  'docs/architecture/dashboard.md': 3_000,
  'docs/architecture/mediator-dashboard.md': 4_500,
  'docs/architecture/npc-builder.md': 2_000,
  'docs/design-system/entity-display-language.md': 6_000,
  'docs/design-system/ruleset.md': 13_350,
  'docs/design-system/sources.md': 3_600,
  'docs/ops/cloud-environment.md': 3_800,
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
  ]
  for (const [doc, budget] of Object.entries(collapsed)) {
    if (existsSync(join(root, doc))) budgeted.push([doc, budget])
    else failures.push(`COLLAPSED_DOCS names ${doc}, which does not exist. Remove the entry.`)
  }
  for (const [doc, base] of budgeted) {
    const budget = overBudget[doc] ?? base
    const text = read(root, doc)
    const imported = importsOf(doc, text)
    let size = [...text].length
    for (const path of imported) {
      if (existsSync(join(root, path))) size += [...read(root, path)].length
      else failures.push(`${doc} imports @${path}, which does not exist.`)
    }
    if (size > budget) {
      const what = imported.length > 0 ? `${doc} with ${imported.join(', ')}` : doc
      failures.push(
        `${what} is ${size} characters, over its ${budget}-character budget. Cut it: no rosters, ` +
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

// ─── load ───────────────────────────────────────────────────────────────────

/** The sessions the repo budgets (`gates/lib/sessionLoad`), each held to `SESSION_CEILINGS`. */
const SESSION_PROFILES: Record<string, SessionProfile> = {
  srd: { dirs: ['apps/srd'], reads: [] },
  /** The Convex CLI writes the guidelines; a Convex upgrade that grows them raises this on purpose. */
  'itun+component-lib': {
    dirs: ['apps/itun', 'packages/component-lib'],
    reads: ['apps/itun/convex/_generated/ai/guidelines.md'],
  },
  bot: { dirs: ['apps/discord-bot'], reads: [] },
}

/**
 * Characters each profile loads, held at today's total: a ratchet. Lower an
 * entry when its total drops more than `SESSION_SLACK` under it (the check says
 * so); raise one only on purpose, saying why in the commit.
 */
const SESSION_CEILINGS: Record<string, number> = {
  srd: 30_748,
  'itun+component-lib': 71_591,
  bot: 27_255,
}

// ─── runner ─────────────────────────────────────────────────────────────────

const CHECKS = [
  checkBacktickedPathsExist,
  checkReferencedScripts,
  (root: string) => checkFixHints(root),
  (root: string) => checkRetiredClaims(root),
  (root: string) => checkMarkdownLinks(root),
  (root: string) => checkAreaCitations(root),
  (root: string) => checkDecisions(root),
  (root: string) => checkTerseShape(root),
  (root: string) => checkDocSizes(root),
  (root: string) => checkSessionLoad(root, SESSION_PROFILES, SESSION_CEILINGS),
  checkCommentHistory,
] as const

if (import.meta.main) {
  // A collapsed corpus (a renamed doc directory) would pass every check: floor(0.65 × 21).
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
