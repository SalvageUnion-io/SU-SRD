/**
 * ssg/snapshot.ts — the output gate for the srd static build.
 *
 * Replaces the retired `ssg/parity.ts`. It answers the same question — "did the
 * emitted site change in a way nobody intended?" — against a baseline that
 * CANNOT rot, which is the whole point of the redesign.
 *
 * ## Why this exists, and why it is shaped differently to parity
 *
 * Parity compared `dist` against an archived **Astro-era** build. That baseline
 * was foreign (produced by a stack this repo deleted), ~56 MB, gitignored, and
 * regenerable only by installing ~2,200 Astro-era packages. So it was absent
 * from every checkout, the gate exited 2 wherever it was invoked, and it was
 * never in CI — while nine files still instructed people to run it. See
 * ADR-031's "shelf life" clause.
 *
 * This gate inverts every one of those properties:
 *
 *   - the baseline is **our own output**, so it can always be regenerated;
 *   - it is a ~680 KB **digest**, not a copy of the site, so it is committed and
 *     every checkout has it;
 *   - regenerating is `bun run snapshot:update` — one command, ~3s;
 *   - it runs in **CI**, which parity never did;
 *   - a change to it appears in the PR diff, where a human sees it.
 *
 * The trade is explicit: parity could catch a regression against a
 * known-good ORACLE (Astro's output). This cannot — it only catches
 * *unintended* change against what we last blessed. A wrong output that is
 * committed as the snapshot is wrong forever. That is the price of a baseline
 * that survives, and it is the right trade, because a gate nobody can run
 * catches nothing at all.
 *
 * ## What is covered
 *
 *   - the exact emitted **file set**, both directions (this is what holds the
 *     page count — a route dropped from `routes.ts` fails here)
 *   - per page: `<title>`, description, canonical, robots — stored as PLAINTEXT
 *     so the diff is readable — plus a digest of every `og:*`/`twitter:*` tag
 *   - per page: the ordered list of JSON-LD `@type`s
 *   - per page: a digest of `<main>`'s normalized visible text, and its length
 *   - every JSON endpoint (899), canonicalized then digested
 *   - `llms.txt`, the sitemaps, `_headers`, the webmanifest — digested
 *
 * ## What is deliberately NOT covered
 *
 *   - **bundle bytes** (`assets/**`, `sw.js`). Their filenames are
 *     content-addressed and their content changes on every dependency bump, so
 *     digesting them would make the snapshot churn constantly — and a gate that
 *     fires on non-changes is a gate that gets disabled. Hashed names are
 *     normalized to `-[hash]` so the file SET is still asserted.
 *   - **binary assets** (images, fonts): presence only, same reasoning.
 *   - **markup and attributes inside `<main>`.** The digest is of visible TEXT,
 *     so a change that alters only attributes passes. This is not hypothetical:
 *     the `CardImage` regression that hid every piece of entity artwork behind
 *     `style="opacity:0"` (#717) does NOT fail this gate — verified. Hashing
 *     `<main>`'s full markup instead would catch it, at the cost of firing on
 *     every Tailwind class change, which in this repo is constant; a gate that
 *     fires on cosmetic churn stops being read. The trade is deliberate, and
 *     the consequence is that **visual regressions are not this gate's job.**
 *
 * None of these were covered by parity either, so none is a reduction.
 */

import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canonicalize,
  digest,
  extractHeadMeta,
  isInsertionOf,
  jsonLdTypes,
  mainText,
} from './htmlDigest.js'

const DEFAULT_DIST = fileURLToPath(new URL('../dist/', import.meta.url))
const DEFAULT_SNAPSHOT = fileURLToPath(new URL('./output-snapshot.json', import.meta.url))

/**
 * Pages whose `<main>` text legitimately GAINS content without any existing
 * content changing — stored in FULL and compared with `isInsertionOf` rather
 * than by digest.
 *
 * Only `/changelog` qualifies, for a structural reason: it renders at build
 * time from the two `CHANGELOG.md` files that release-please **prepends** to on
 * every release. Under plain equality, every release PR would fail this gate
 * and need a snapshot regeneration to land — which is a release deadlock, a
 * failure mode this repo has already had once (#700).
 *
 * This is NOT an ignore. `isInsertionOf` is a real and strictly stronger
 * assertion than "unchanged" can be on a file designed to change: every
 * character previously emitted must still be present, in order, with the growth
 * confined to a single contiguous insertion. Deleting an old entry, reordering
 * entries, or rewording one all still FAIL. The cost is 26 KB of stored text,
 * and the gate reports the exemption on every run — an exemption nobody can see
 * is indistinguishable from the gate not running.
 */
const APPEND_ONLY_PAGES = new Set(['changelog/index.html'])

/** Extensions whose CONTENT is digested (as opposed to presence-only). */
const TEXT_DIGESTED = new Set(['.json', '.xml', '.txt', '.webmanifest'])
/** Extensionless files whose content is digested. */
const TEXT_DIGESTED_NAMES = new Set(['_headers'])

export type PageDigest = {
  title: string | null
  description: string | null
  canonical: string | null
  robots: string | null
  /** Digest of the canonicalized `og:*` / `twitter:*` map. */
  social: string
  /** JSON-LD `@type`s, in document order. */
  jsonLd: string[]
  /** Digest of normalized `<main>` text; `null` when the page has no `<main>`. */
  main: string | null
  mainChars: number
}

export type FileDigest = { hash: string; bytes: number }

export type Snapshot = {
  version: 1
  counts: { files: number; html: number; digested: number; presenceOnly: number }
  /** Reported on every run so the exemption is never invisible. */
  appendOnly: string[]
  files: string[]
  html: Record<string, PageDigest>
  files_digested: Record<string, FileDigest>
  /** Full normalized `<main>` text for `APPEND_ONLY_PAGES`. */
  appendOnlyText: Record<string, string>
}

// ---------------------------------------------------------------------------
// Filesystem
// ---------------------------------------------------------------------------

const walk = async (root: string): Promise<string[]> => {
  const out: string[] = []
  const visit = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) await visit(full)
      else if (entry.isFile()) out.push(relative(root, full).split(sep).join('/'))
    }
  }
  await visit(root)
  out.sort()
  return out
}

export const dirExists = async (dir: string): Promise<boolean> => {
  try {
    return (await stat(dir)).isDirectory()
  } catch {
    return false
  }
}

/**
 * Collapse content-addressed filenames so the file SET is stable across
 * rebuilds: `assets/actions-oTvnK7W9.js` -> `assets/actions-[hash].js`.
 *
 * Scoped to `assets/` (plus the workbox chunk) rather than applied globally, so
 * a real page path that happens to end in `-xxxxxxxx` is never mangled. Vite's
 * hash alphabet is base64url, which includes `-`, so the pattern anchors on the
 * FINAL 8 characters before the extension.
 */
export const normalizeEmittedPath = (path: string): string => {
  const asset = /^(assets\/.*?)-[A-Za-z0-9_-]{8}(\.[a-z0-9]+)$/.exec(path)
  if (asset) return `${asset[1]}-[hash]${asset[2]}`
  if (/^workbox-[A-Za-z0-9_-]+\.js$/.test(path)) return 'workbox-[hash].js'
  return path
}

const extensionOf = (path: string): string => {
  const dot = path.lastIndexOf('.')
  const slash = path.lastIndexOf('/')
  return dot > slash ? path.slice(dot) : ''
}

/** Whether this file's CONTENT contributes to the snapshot. */
export const isContentDigested = (path: string): boolean => {
  // Bundle output and the service worker are presence-only — see the header.
  if (path.startsWith('assets/')) return false
  if (path === 'sw.js' || path.startsWith('workbox-')) return false
  const base = path.slice(path.lastIndexOf('/') + 1)
  if (TEXT_DIGESTED_NAMES.has(base)) return true
  return TEXT_DIGESTED.has(extensionOf(path))
}

// ---------------------------------------------------------------------------
// Building a snapshot
// ---------------------------------------------------------------------------

export const digestPage = (html: string): PageDigest => {
  const head = extractHeadMeta(html)
  const text = mainText(html)
  return {
    title: head.title,
    description: head.description,
    canonical: head.canonical,
    robots: head.robots,
    social: digest(canonicalize(head.social)),
    jsonLd: jsonLdTypes(html),
    main: text === null ? null : digest(text),
    mainChars: text === null ? -1 : text.length,
  }
}

export const buildSnapshot = async (dist: string): Promise<Snapshot> => {
  const paths = await walk(dist)
  const files: string[] = []
  const html: Record<string, PageDigest> = {}
  const filesDigested: Record<string, FileDigest> = {}
  const appendOnlyText: Record<string, string> = {}
  let presenceOnly = 0

  for (const path of paths) {
    files.push(normalizeEmittedPath(path))

    if (path.endsWith('.html')) {
      const source = await readFile(join(dist, path), 'utf8')
      html[path] = digestPage(source)
      if (APPEND_ONLY_PAGES.has(path)) {
        appendOnlyText[path] = mainText(source) ?? ''
      }
      continue
    }

    if (!isContentDigested(path)) {
      presenceOnly += 1
      continue
    }

    const raw = await readFile(join(dist, path), 'utf8')
    // JSON is canonicalized before digesting so a pure key-reordering refactor
    // does not read as a content change.
    let content = raw
    if (path.endsWith('.json') || path.endsWith('.webmanifest')) {
      try {
        content = canonicalize(JSON.parse(raw))
      } catch {
        content = `!unparseable:${raw}`
      }
    }
    filesDigested[path] = { hash: digest(content), bytes: Buffer.byteLength(raw) }
  }

  files.sort()
  return {
    version: 1,
    counts: {
      files: files.length,
      html: Object.keys(html).length,
      digested: Object.keys(filesDigested).length,
      presenceOnly,
    },
    appendOnly: [...APPEND_ONLY_PAGES].sort(),
    files,
    html,
    files_digested: filesDigested,
    appendOnlyText,
  }
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Stable JSON with ONE LINE PER ENTRY.
 *
 * `JSON.stringify(snapshot, null, 2)` would spread each page over ten lines, so
 * a single changed `<title>` lands in the middle of a ten-line hunk and the
 * review diff for a content change runs to thousands of lines. Emitting each
 * page as one line makes "23 pages changed" literally 23 changed lines — which
 * is the only reason committing this file is useful rather than just large.
 * It also drops the file from ~800 KB to roughly half that.
 *
 * Output is ordinary JSON; `JSON.parse` reads it back.
 */
export const serializeSnapshot = (snapshot: Snapshot): string => {
  const entries = (record: Record<string, unknown>): string => {
    const keys = Object.keys(record).sort()
    if (keys.length === 0) return '{}'
    const lines = keys.map((key) => `    ${JSON.stringify(key)}: ${JSON.stringify(record[key])}`)
    return `{\n${lines.join(',\n')}\n  }`
  }
  return [
    '{',
    `  "version": ${JSON.stringify(snapshot.version)},`,
    `  "counts": ${JSON.stringify(snapshot.counts)},`,
    `  "appendOnly": ${JSON.stringify(snapshot.appendOnly)},`,
    `  "files": [\n${snapshot.files.map((f) => `    ${JSON.stringify(f)}`).join(',\n')}\n  ],`,
    `  "html": ${entries(snapshot.html as Record<string, unknown>)},`,
    `  "files_digested": ${entries(snapshot.files_digested as Record<string, unknown>)},`,
    `  "appendOnlyText": ${entries(snapshot.appendOnlyText as Record<string, unknown>)}`,
    '}',
    '',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export type Finding = { kind: string; path: string; detail: string }

const listDiff = (expected: string[], actual: string[]) => {
  const before = new Set(expected)
  const after = new Set(actual)
  return {
    missing: expected.filter((p) => !after.has(p)),
    added: actual.filter((p) => !before.has(p)),
  }
}

const field = (name: string, a: unknown, b: unknown): string | null =>
  a === b ? null : `${name}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`

export const comparePages = (path: string, expected: PageDigest, actual: PageDigest): Finding[] => {
  const parts = [
    field('title', expected.title, actual.title),
    field('description', expected.description, actual.description),
    field('canonical', expected.canonical, actual.canonical),
    field('robots', expected.robots, actual.robots),
    expected.social === actual.social ? null : 'og/twitter tags changed',
    expected.jsonLd.join('|') === actual.jsonLd.join('|')
      ? null
      : `json-ld: [${expected.jsonLd.join(', ')}] -> [${actual.jsonLd.join(', ')}]`,
  ].filter((p): p is string => p !== null)

  // `<main>` for append-only pages is compared by the caller, which holds the
  // stored text; here we only compare the digest for every other page.
  if (!APPEND_ONLY_PAGES.has(path) && expected.main !== actual.main) {
    parts.push(`main text changed (${expected.mainChars} -> ${actual.mainChars} chars)`)
  }
  return parts.map((detail) => ({ kind: 'page', path, detail }))
}

export const compare = (expected: Snapshot, actual: Snapshot): Finding[] => {
  const findings: Finding[] = []

  const fileDiff = listDiff(expected.files, actual.files)
  for (const path of fileDiff.missing) {
    findings.push({ kind: 'file-set', path, detail: 'emitted before, MISSING now' })
  }
  for (const path of fileDiff.added) {
    findings.push({ kind: 'file-set', path, detail: 'NEW, not in the snapshot' })
  }

  for (const [path, before] of Object.entries(expected.html)) {
    const after = actual.html[path]
    if (!after) continue // already reported by the file-set diff
    findings.push(...comparePages(path, before, after))

    if (APPEND_ONLY_PAGES.has(path)) {
      const beforeText = expected.appendOnlyText[path] ?? ''
      const afterText = actual.appendOnlyText[path] ?? ''
      if (!isInsertionOf(beforeText, afterText)) {
        findings.push({
          kind: 'append-only',
          path,
          detail:
            'this page may only GAIN content: existing text was removed, reordered or reworded ' +
            `(${beforeText.length} -> ${afterText.length} chars)`,
        })
      }
    }
  }

  for (const [path, before] of Object.entries(expected.files_digested)) {
    const after = actual.files_digested[path]
    if (!after) continue
    if (before.hash !== after.hash) {
      findings.push({
        kind: 'content',
        path,
        detail: `content changed (${before.bytes} -> ${after.bytes} bytes)`,
      })
    }
  }

  return findings
}

/** Growth on append-only pages, so the exemption is always visible. */
export const appendOnlyGrowth = (expected: Snapshot, actual: Snapshot): string[] =>
  [...APPEND_ONLY_PAGES].flatMap((path) => {
    const before = (expected.appendOnlyText[path] ?? '').length
    const after = (actual.appendOnlyText[path] ?? '').length
    if (before === after) return []
    return [`${path}: +${after - before} chars inserted (compared for insertion, not equality)`]
  })

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export type Options = { dist: string; snapshot: string; update: boolean }

export const parseArgs = (argv: string[]): Options | 'help' => {
  const opts: Options = { dist: DEFAULT_DIST, snapshot: DEFAULT_SNAPSHOT, update: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--update' || arg === '-u') opts.update = true
    else if (arg === '--dist') opts.dist = argv[++i] ?? opts.dist
    else if (arg === '--snapshot') opts.snapshot = argv[++i] ?? opts.snapshot
    else if (arg === '--help' || arg === '-h') return 'help'
    else {
      process.stderr.write(`snapshot: unknown flag ${arg}\n`)
      return 'help'
    }
  }
  return opts
}

const HELP = [
  'Usage: bun ssg/snapshot.ts [options]',
  '',
  '  (no flags)          compare dist against ssg/output-snapshot.json; exit 1 on any difference',
  '  --update, -u        rewrite the snapshot from the current dist',
  '  --dist <dir>        the built site to read (default: apps/srd/dist)',
  '  --snapshot <file>   the baseline to read/write (default: ssg/output-snapshot.json)',
  '',
  'Build first: bun ssg/build.ts',
].join('\n')

export const run = async (opts: Options): Promise<number> => {
  if (!(await dirExists(opts.dist))) {
    process.stderr.write(
      `snapshot: no build to check at ${opts.dist}\nRun \`bun ssg/build.ts\` first.\n`
    )
    return 2
  }

  const actual = await buildSnapshot(opts.dist)

  if (opts.update) {
    await writeFile(opts.snapshot, serializeSnapshot(actual))
    process.stdout.write(
      `snapshot updated — ${actual.counts.html} pages, ` +
        `${actual.counts.digested} digested files, ` +
        `${actual.counts.presenceOnly} presence-only.\n` +
        'Review the diff: it is the complete list of what your change did to the site.\n'
    )
    return 0
  }

  let expected: Snapshot
  try {
    expected = JSON.parse(await readFile(opts.snapshot, 'utf8')) as Snapshot
  } catch {
    process.stderr.write(
      `snapshot: cannot read baseline ${opts.snapshot}\n` +
        'It is committed to the repo; if this is a new build, create it with ' +
        '`bun run snapshot:update`.\n'
    )
    return 2
  }

  const findings = compare(expected, actual)
  const growth = appendOnlyGrowth(expected, actual)

  const out: string[] = ['srd output snapshot gate']
  out.push(
    `  scope: ${actual.counts.html} pages, ${actual.counts.digested} digested files, ` +
      `${actual.counts.presenceOnly} presence-only, ${actual.counts.files} paths`
  )
  for (const line of growth) out.push(`  append-only growth on ${line}`)
  if (growth.length === 0 && expected.appendOnly.length > 0) {
    out.push(`  append-only pages (unchanged this run): ${expected.appendOnly.join(', ')}`)
  }
  out.push('')

  if (findings.length === 0) {
    out.push(`SNAPSHOT OK — ${actual.counts.html} pages, zero unexpected differences.`)
    process.stdout.write(`${out.join('\n')}\n`)
    return 0
  }

  const byPath = new Map<string, Finding[]>()
  for (const finding of findings) {
    const bucket = byPath.get(finding.path) ?? []
    bucket.push(finding)
    byPath.set(finding.path, bucket)
  }
  const shown = [...byPath.entries()].slice(0, 40)
  for (const [path, bucket] of shown) {
    out.push(`  ${path}`)
    for (const finding of bucket) out.push(`      [${finding.kind}] ${finding.detail}`)
  }
  if (byPath.size > shown.length) out.push(`  … and ${byPath.size - shown.length} more path(s)`)

  out.push('')
  out.push(
    `SNAPSHOT FAILED — ${findings.length} difference(s) across ${byPath.size} path(s).`,
    '',
    'If these changes are INTENDED, re-bless the output:',
    '  bun ssg/build.ts && bun run snapshot:update',
    'and commit the snapshot with your change, so the diff is reviewed alongside it.'
  )
  process.stdout.write(`${out.join('\n')}\n`)
  return 1
}

if (import.meta.main) {
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed === 'help') {
    process.stdout.write(`${HELP}\n`)
    process.exit(0)
  }
  process.exit(await run(parsed))
}
