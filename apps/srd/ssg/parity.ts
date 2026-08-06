#!/usr/bin/env bun
/**
 * ssg/parity.ts — the acceptance gate for the Astro -> in-house SSG migration.
 *
 * Compares a candidate `dist` against the Astro baseline `dist` SEMANTICALLY.
 * Byte equality is explicitly NOT the goal: Astro injects its own attributes,
 * its own transition scopes, its own island custom elements and its own hashed
 * bundle filenames. What must match is the *meaning* of every emitted page.
 *
 * See DESIGN.md "Verification — the parity script". This script is the judge.
 *
 * Usage:
 *   bun ssg/parity.ts [--baseline <dir>] [--candidate <dir>] [--limit N]
 *                     [--no-ignore-island-text] [--strict-assets]
 *
 * Exits non-zero on any fatal mismatch.
 */

import { readdir, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * The Astro baseline to compare against.
 *
 * It comes from `SRD_PARITY_BASELINE`, falling back to
 * `apps/srd/.parity-baseline` (gitignored, ~56 MB) so a checkout has a
 * conventional place to put one.
 *
 * **A missing baseline is not a dead gate — regenerate it:**
 *
 *     bun run parity:baseline   # ssg/make-parity-baseline.ts
 *     bun ssg/build.ts && bun run parity
 *
 * The baseline is a pure function of a commit still in history, so
 * `make-parity-baseline.ts` derives the last Astro commit (the parent of
 * whichever commit deleted `apps/srd/astro.config.mjs` — not hardcoded), builds
 * it in a throwaway detached worktree, and copies the result here. It costs
 * minutes and needs network for the Astro-era install (~2,200 packages), which
 * is why it is deliberately NOT part of `check:all`.
 *
 * This comment previously said the baseline "must be handed to you" because
 * Astro is deleted. That was true before `make-parity-baseline.ts` existed, and
 * the stale claim outlived it — long enough to convince a reader that the whole
 * gate was unsalvageable and should be deleted. It is not; see
 * `apps/srd/CLAUDE.md` "If the baseline is missing, regenerate it".
 *
 * The path used to be hardcoded to the agent job directory that first produced
 * the baseline, which made the documented "acceptance gate" exit 2 for every
 * other person and machine.
 *
 * ## `/changelog` grows forever — see `APPEND_ONLY_PAGES`
 *
 * The baseline is frozen at the last Astro commit, but `/changelog` renders at
 * build time from the two CHANGELOG.md files release-please prepends to on
 * every release. The candidate therefore always carries entries the baseline
 * cannot have, and the gap widens with each release, by construction.
 *
 * That page is compared under `isInsertionOf` rather than equality: every
 * character the baseline emitted must still be present, in order, with the
 * growth confined to one contiguous insertion. Deleting, reordering or
 * rewording an old entry still fails. The growth is reported in the scope
 * block, because an exemption nobody can see is indistinguishable from the gate
 * not running.
 *
 * The tempting fix was an ignore flag. That would have made the page assert
 * nothing; this asserts something strictly stronger than "unchanged" is able to
 * on a file that is designed to change.
 */
const DEFAULT_BASELINE =
  process.env.SRD_PARITY_BASELINE ?? fileURLToPath(new URL('../.parity-baseline/', import.meta.url))

// `fileURLToPath`, not `.pathname` — the latter stays percent-encoded, so any
// checkout under a path with a space resolves to a directory that does not
// exist. Every other module under ssg/ already uses fileURLToPath.
const DEFAULT_CANDIDATE = fileURLToPath(new URL('../dist/', import.meta.url))

export type Options = {
  baseline: string
  candidate: string
  /** Max examples printed per category. */
  limit: number
  /** Exclude ssr:false island subtrees from the <main> text comparison. */
  ignoreIslandText: boolean
  /** Treat hashed bundle-output path differences as fatal too. */
  strictAssets: boolean
}

export const parseArgs = (argv: string[]): Options => {
  const opts: Options = {
    baseline: DEFAULT_BASELINE,
    candidate: DEFAULT_CANDIDATE,
    limit: 20,
    ignoreIslandText: true,
    strictAssets: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? ''
    const eq = arg.indexOf('=')
    const name = eq === -1 ? arg : arg.slice(0, eq)
    const inlineValue = eq === -1 ? undefined : arg.slice(eq + 1)
    const take = (): string => {
      if (inlineValue !== undefined) return inlineValue
      i += 1
      return argv[i] ?? ''
    }
    switch (name) {
      case '--baseline':
        opts.baseline = take()
        break
      case '--candidate':
        opts.candidate = take()
        break
      case '--limit':
        opts.limit = Number.parseInt(take(), 10) || 20
        break
      case '--ignore-island-text':
        opts.ignoreIslandText = true
        break
      case '--no-ignore-island-text':
        opts.ignoreIslandText = false
        break
      case '--strict-assets':
        opts.strictAssets = true
        break
      case '--help':
      case '-h':
        process.stdout.write(
          [
            'Usage: bun ssg/parity.ts [options]',
            '',
            `  --baseline <dir>            default ${DEFAULT_BASELINE}`,
            '  --candidate <dir>           default apps/srd/dist',
            '  --limit N                   examples shown per category (default 20)',
            '  --no-ignore-island-text     do NOT exclude ssr:false island subtrees',
            '                              from the <main> text comparison',
            '  --strict-assets             make hashed bundle-output path',
            '                              differences fatal as well',
            '',
          ].join('\n')
        )
        process.exit(0)
        break
      default:
        if (arg.startsWith('-')) {
          process.stderr.write(`parity: unknown flag ${arg}\n`)
          process.exit(2)
        }
    }
  }
  return opts
}

// ---------------------------------------------------------------------------
// Island policy (DESIGN.md "Per-island decisions")
// ---------------------------------------------------------------------------

/**
 * Islands DESIGN.md marks `ssr: false`. In the new system these render an empty
 * placeholder and mount client-side with `createRoot`; Astro server-rendered
 * their markup. Their subtrees are therefore excluded from the visible-text
 * comparison on BOTH sides, so the exclusion is symmetric and cannot hide a
 * regression in content that is genuinely server-rendered by both systems.
 */
export const NON_SSR_ISLANDS = new Set([
  'SearchIsland',
  'MobileSearchIsland',
  'MobileNavIsland',
  'ReferenceEntityIsland',
  'SearchResultsIsland',
  'OgCardIsland',
])

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

const dirExists = async (dir: string): Promise<boolean> => {
  try {
    return (await stat(dir)).isDirectory()
  } catch {
    return false
  }
}

/**
 * Hashed bundle output. These filenames are content-addressed and the chunk
 * graph legitimately differs between Astro's build and Vite's, so a path-set
 * difference here is reported but not fatal unless --strict-assets.
 */
export const isBundleAsset = (path: string): boolean =>
  path.startsWith('_astro/') ||
  path.startsWith('assets/') ||
  path.startsWith('.vite/') ||
  /^workbox-[^/]*\.js$/.test(path)

// ---------------------------------------------------------------------------
// Tolerant HTML scanning
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  times: '×',
  middot: '·',
  bull: '•',
  deg: '°',
  copy: '©',
  reg: '®',
  trade: '™',
  laquo: '«',
  raquo: '»',
  eacute: 'é',
  egrave: 'è',
  ouml: 'ö',
  uuml: 'ü',
  auml: 'ä',
  szlig: 'ß',
  minus: '−',
  prime: '′',
  frac12: '½',
  shy: '\u00ad',
  ensp: '\u2002',
  emsp: '\u2003',
  thinsp: '\u2009',
}

export const decodeEntities = (input: string): string => {
  if (!input.includes('&')) return input
  return input.replace(
    /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]{1,31});/g,
    (whole, body: string) => {
      if (body.startsWith('#x') || body.startsWith('#X')) {
        const code = Number.parseInt(body.slice(2), 16)
        return Number.isFinite(code) ? String.fromCodePoint(code) : whole
      }
      if (body.startsWith('#')) {
        const code = Number.parseInt(body.slice(1), 10)
        return Number.isFinite(code) ? String.fromCodePoint(code) : whole
      }
      const named = NAMED_ENTITIES[body]
      return named ?? whole
    }
  )
}

/** Attribute scanner tolerant of bare attributes and single/double quotes. */
const ATTR_RE = /([a-zA-Z_:@][-a-zA-Z0-9_:.]*)\s*(?:=\s*("[^"]*"|'[^']*'|[^\s"'`=<>]*))?/g

export const parseAttrs = (raw: string): Record<string, string> => {
  const attrs: Record<string, string> = {}
  ATTR_RE.lastIndex = 0
  let match = ATTR_RE.exec(raw)
  while (match) {
    const key = (match[1] ?? '').toLowerCase()
    let value = match[2] ?? ''
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in attrs)) attrs[key] = decodeEntities(value)
    match = ATTR_RE.exec(raw)
  }
  return attrs
}

/** An opening tag, tolerating `>` inside quoted attribute values. */
const OPEN_TAG_RE = /<([a-zA-Z][-a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g

/** Any tag (open, close, doctype, processing instruction), same tolerance. */
const ANY_TAG_RE = /<[!/]?[a-zA-Z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>|<!\[[^\]]*\]>/g

/**
 * Index of the `<` of the close tag that balances an element whose body starts
 * at `from`. Returns -1 when unbalanced.
 */
const matchingCloseIndex = (html: string, tagName: string, from: number): number => {
  const re = new RegExp(`<(/?)${tagName.replace(/[^\w-]/g, '')}\\b`, 'gi')
  re.lastIndex = from
  let depth = 1
  let match = re.exec(html)
  while (match) {
    if (match[1] === '/') {
      depth -= 1
      if (depth === 0) return match.index
    } else {
      depth += 1
    }
    match = re.exec(html)
  }
  return -1
}

/** Inner HTML of the first `<main>` element, or null when the page has none. */
export const extractMainInner = (html: string): string | null => {
  const open = /<main\b((?:[^>"']|"[^"]*"|'[^']*')*)>/i.exec(html)
  if (!open) return null
  const bodyStart = open.index + open[0].length
  const closeIdx = matchingCloseIndex(html, 'main', bodyStart)
  return closeIdx < 0 ? html.slice(bodyStart) : html.slice(bodyStart, closeIdx)
}

const sliceHead = (html: string): string => {
  const open = html.search(/<head\b/i)
  const close = html.search(/<\/head\b[^>]*>/i)
  if (open === -1 || close === -1 || close < open) return html
  return html.slice(open, close)
}

/**
 * Remove `<tag>…</tag>` blocks wholesale (scripts, styles).
 *
 * The end-tag pattern is `<\/tag\b[^>]*>`, not `<\/tag\s*>`. HTML parsers
 * accept junk inside a closing tag — `</script\t\n foo>` closes a script — so
 * the narrower form silently fails to match and this function then swallows
 * everything to the NEXT well-formed `</script>`, or to end-of-string. In a
 * comparator that is not a cosmetic bug: dropping too much of one side's
 * `<main>` is exactly how a real content regression gets reported as "identical".
 */
const removeBlocks = (html: string, tagName: string): string =>
  html.replace(new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}\\b[^>]*>`, 'gi'), ' ')

/**
 * Strip HTML comments.
 *
 * Two subtleties, both of which a single non-global-loop `replace` gets wrong:
 *   - a comment may be terminated by `--!>` as well as `-->`;
 *   - once comments are removed, the surrounding text can form a NEW `<!--`
 *     (`<!<!---->--` collapses to `<!--`), so one pass is not a fixed point.
 * Loop to stability, and drop an unterminated trailing `<!--` outright rather
 * than leaving it to be re-parsed as markup.
 */
const removeComments = (html: string): string => {
  let out = html
  for (;;) {
    const next = out.replace(/<!--[\s\S]*?--!?>/g, '')
    if (next === out) break
    out = next
  }
  return out.replace(/<!--[\s\S]*$/, '')
}

/**
 * Drop the subtree of every element the matcher accepts, in one left-to-right
 * pass. Returns the surviving HTML plus how many subtrees were removed.
 */
const stripSubtrees = (
  html: string,
  matcher: (tagName: string, rawAttrs: string) => boolean
): { html: string; count: number } => {
  let result = ''
  let last = 0
  let count = 0
  OPEN_TAG_RE.lastIndex = 0
  let match = OPEN_TAG_RE.exec(html)
  while (match) {
    const tagName = match[1] ?? ''
    const rawAttrs = match[2] ?? ''
    const selfClosing = rawAttrs.trimEnd().endsWith('/')
    if (!selfClosing && matcher(tagName.toLowerCase(), rawAttrs)) {
      const bodyStart = OPEN_TAG_RE.lastIndex
      const closeIdx = matchingCloseIndex(html, tagName, bodyStart)
      let endIdx = html.length
      if (closeIdx >= 0) {
        const gt = html.indexOf('>', closeIdx)
        endIdx = gt === -1 ? html.length : gt + 1
      }
      result += html.slice(last, match.index)
      last = endIdx
      count += 1
      OPEN_TAG_RE.lastIndex = endIdx
    }
    match = OPEN_TAG_RE.exec(html)
  }
  result += html.slice(last)
  return { html: result, count }
}

/**
 * Remove the subtrees of islands that are client-mounted with no server
 * markup. Handles both dialects:
 *   - Astro baseline: `<astro-island component-export="X">…</astro-island>`
 *   - New SSG:        `<div data-island="X" data-ssr="false">…</div>`
 * When the new SSG omits `data-ssr` (DESIGN.md's placeholder shape does), the
 * island name is looked up in NON_SSR_ISLANDS instead.
 */
export const stripNonSsrIslands = (html: string): { html: string; count: number } => {
  const hasAstro = html.includes('<astro-island')
  const hasData = html.includes('data-island')
  if (!hasAstro && !hasData) return { html, count: 0 }
  return stripSubtrees(html, (tagName, rawAttrs) => {
    if (tagName === 'astro-island') {
      const name = parseAttrs(rawAttrs)['component-export']
      return name !== undefined && NON_SSR_ISLANDS.has(name)
    }
    if (!rawAttrs.includes('data-island')) return false
    const attrs = parseAttrs(rawAttrs)
    const name = attrs['data-island']
    if (name === undefined) return false
    const ssr = attrs['data-ssr']
    if (ssr !== undefined) return ssr === 'false'
    return NON_SSR_ISLANDS.has(name)
  })
}

/**
 * Pages whose `<main>` text legitimately GAINS content between the baseline and
 * the candidate, without any of the baseline's own content changing.
 *
 * Only `/changelog` qualifies, and only for a structural reason: it renders at
 * build time from `apps/srd/CHANGELOG.md` and
 * `packages/salvageunion-reference/CHANGELOG.md`, which release-please prepends
 * to on every release. The baseline is frozen at the last Astro commit, so the
 * candidate necessarily carries entries the baseline cannot have — and the gap
 * widens with every release, permanently.
 *
 * This is NOT an ignore list. These pages are still compared, just under
 * `isInsertionOf` instead of equality, which is a real assertion: every
 * character the baseline emitted must still be present, in order, with new
 * content confined to a single contiguous insertion. Deleting an old entry,
 * reordering entries, or rewording one all still fail.
 */
export const APPEND_ONLY_PAGES = new Set(['changelog/index.html'])

/**
 * True when `candidate` is exactly `baseline` with one contiguous block
 * inserted — nothing removed, reordered or reworded.
 *
 * Works by taking the common prefix and requiring the entire remainder of the
 * baseline to reappear as the candidate's suffix. For a newest-first changelog
 * the inserted block is the new releases; for a hypothetical append-at-end page
 * the baseline is a pure prefix, which is also non-destructive and also passes.
 */
export const isInsertionOf = (baseline: string, candidate: string): boolean => {
  if (baseline === candidate) return true
  if (candidate.length <= baseline.length) return false
  let i = 0
  while (i < baseline.length && baseline[i] === candidate[i]) i += 1
  // Whole baseline matched as a prefix: content was added at the end only.
  if (i === baseline.length) return true
  return candidate.endsWith(baseline.slice(i))
}

export const normalizeText = (html: string): string =>
  decodeEntities(html.replace(ANY_TAG_RE, ' '))
    .replace(/[\s\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000\ufeff]+/g, ' ')
    .trim()

// ---------------------------------------------------------------------------
// Head metadata
// ---------------------------------------------------------------------------

export type HeadMeta = {
  title: string | null
  description: string | null
  canonical: string | null
  robots: string | null
  /** og:* and twitter:* keys -> their content values, in document order. */
  social: Record<string, string[]>
}

export const extractHeadMeta = (html: string): HeadMeta => {
  const head = sliceHead(html)
  const meta: HeadMeta = {
    title: null,
    description: null,
    canonical: null,
    robots: null,
    social: {},
  }

  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title\b[^>]*>/i.exec(head)
  if (titleMatch)
    meta.title = decodeEntities(titleMatch[1] ?? '')
      .replace(/\s+/g, ' ')
      .trim()

  OPEN_TAG_RE.lastIndex = 0
  let match = OPEN_TAG_RE.exec(head)
  while (match) {
    const tagName = (match[1] ?? '').toLowerCase()
    if (tagName === 'meta' || tagName === 'link') {
      const attrs = parseAttrs(match[2] ?? '')
      if (tagName === 'meta') {
        const key = attrs.property ?? attrs.name ?? ''
        const content = attrs.content ?? ''
        if (key === 'description') meta.description = content
        else if (key === 'robots') meta.robots = content
        else if (key.startsWith('og:') || key.startsWith('twitter:')) {
          const bucket = meta.social[key] ?? []
          bucket.push(content)
          meta.social[key] = bucket
        }
      } else if ((attrs.rel ?? '').toLowerCase() === 'canonical') {
        meta.canonical = attrs.href ?? ''
      }
    }
    match = OPEN_TAG_RE.exec(head)
  }
  return meta
}

export type JsonLdBlock = { ok: true; value: unknown } | { ok: false; raw: string; error: string }

export const extractJsonLd = (html: string): JsonLdBlock[] => {
  const blocks: JsonLdBlock[] = []
  // `<\/script\b[^>]*>`, not `<\/script\s*>` — see removeBlocks. A closing tag
  // may carry junk (`</script\t\n foo>`) and still close the element, so the
  // narrower form runs past the real end and swallows the following markup into
  // this block's body, which here would mean feeding JSON.parse the wrong text.
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi
  let match = re.exec(html)
  while (match) {
    const attrs = parseAttrs(match[1] ?? '')
    if ((attrs.type ?? '').toLowerCase() === 'application/ld+json') {
      const raw = (match[2] ?? '').trim()
      try {
        blocks.push({ ok: true, value: JSON.parse(raw) })
      } catch (error) {
        blocks.push({
          ok: false,
          raw,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    match = re.exec(html)
  }
  return blocks
}

// ---------------------------------------------------------------------------
// Deep comparison
// ---------------------------------------------------------------------------

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Order-insensitive-on-keys canonical form, used for equality and sorting. */
export const canonicalize = (value: unknown): string => {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

const preview = (value: unknown, max = 120): string => {
  const text = typeof value === 'string' ? value : canonicalize(value)
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export type ValueDiff = { path: string; baseline: string; candidate: string }

/** First structural difference between two parsed JSON values. */
export const firstJsonDiff = (a: unknown, b: unknown, path = '$'): ValueDiff | null => {
  if (canonicalize(a) === canonicalize(b)) return null
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return { path: `${path}.length`, baseline: String(a.length), candidate: String(b.length) }
    }
    for (let i = 0; i < a.length; i++) {
      const diff = firstJsonDiff(a[i], b[i], `${path}[${i}]`)
      if (diff) return diff
    }
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
    for (const key of keys) {
      if (!(key in a))
        return { path: `${path}.${key}`, baseline: '<absent>', candidate: preview(b[key]) }
      if (!(key in b))
        return { path: `${path}.${key}`, baseline: preview(a[key]), candidate: '<absent>' }
      const diff = firstJsonDiff(a[key], b[key], `${path}.${key}`)
      if (diff) return diff
    }
  }
  return { path, baseline: preview(a), candidate: preview(b) }
}

/** A short window around the first differing character of two texts. */
export const textExcerpt = (
  a: string,
  b: string,
  window = 60
): { at: number; baseline: string; candidate: string } => {
  let i = 0
  const max = Math.min(a.length, b.length)
  while (i < max && a[i] === b[i]) i++
  const from = Math.max(0, i - Math.floor(window / 2))
  const to = i + window
  const mark = (text: string): string =>
    `${from > 0 ? '…' : ''}${text.slice(from, to)}${to < text.length ? '…' : ''}`
  return { at: i, baseline: mark(a), candidate: mark(b) }
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export type Finding = { file: string; detail: string }

type Category = {
  name: string
  fatal: boolean
  findings: Finding[]
  note?: string
}

const compareHeadMeta = (a: HeadMeta, b: HeadMeta): string[] => {
  const out: string[] = []
  const scalar = (label: string, x: string | null, y: string | null): void => {
    if (x !== y) out.push(`${label}: baseline=${JSON.stringify(x)} candidate=${JSON.stringify(y)}`)
  }
  scalar('<title>', a.title, b.title)
  scalar('meta[name=description]', a.description, b.description)
  scalar('link[rel=canonical]', a.canonical, b.canonical)
  scalar('meta[name=robots]', a.robots, b.robots)
  const keys = [...new Set([...Object.keys(a.social), ...Object.keys(b.social)])].sort()
  for (const key of keys) {
    const x = a.social[key]
    const y = b.social[key]
    if (canonicalize(x ?? null) !== canonicalize(y ?? null)) {
      out.push(
        `meta[${key}]: baseline=${x ? JSON.stringify(x) : '<absent>'} candidate=${y ? JSON.stringify(y) : '<absent>'}`
      )
    }
  }
  return out
}

const compareJsonLd = (a: JsonLdBlock[], b: JsonLdBlock[]): string[] => {
  const out: string[] = []
  for (const [label, blocks] of [
    ['baseline', a],
    ['candidate', b],
  ] as const) {
    for (const block of blocks) {
      if (!block.ok)
        out.push(`ld+json unparseable in ${label}: ${block.error} :: ${preview(block.raw)}`)
    }
  }
  if (out.length > 0) return out
  if (a.length !== b.length) {
    out.push(`ld+json block count: baseline=${a.length} candidate=${b.length}`)
    return out
  }
  // Compare as an unordered multiset — head order carries no meaning.
  const key = (block: JsonLdBlock): string => (block.ok ? canonicalize(block.value) : block.raw)
  const av = [...a].map(key).sort()
  const bv = [...b].map(key).sort()
  for (let i = 0; i < av.length; i++) {
    if (av[i] !== bv[i]) {
      const parsedA = a.find((block) => key(block) === av[i])
      const parsedB = b.find((block) => key(block) === bv[i])
      const diff = parsedA?.ok && parsedB?.ok ? firstJsonDiff(parsedA.value, parsedB.value) : null
      out.push(
        diff
          ? `ld+json block ${i} differs at ${diff.path}: baseline=${diff.baseline} candidate=${diff.candidate}`
          : `ld+json block ${i} differs: baseline=${preview(av[i])} candidate=${preview(bv[i])}`
      )
      break
    }
  }
  return out
}

const readText = async (path: string): Promise<string> => await Bun.file(path).text()

const mapLimit = async <T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> => {
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, async () => {
    for (;;) {
      const index = cursor++
      if (index >= items.length) return
      const item = items[index]
      if (item === undefined) return
      await worker(item, index)
    }
  })
  await Promise.all(runners)
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const listExamples = (findings: readonly Finding[], limit: number): string[] => {
  const shown = findings
    .slice(0, limit)
    .map(
      (f) =>
        `      - ${f.file}${f.detail ? `\n          ${f.detail.replace(/\n/g, '\n          ')}` : ''}`
    )
  if (findings.length > limit) shown.push(`      … and ${findings.length - limit} more`)
  return shown
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export const run = async (opts: Options): Promise<number> => {
  const out: string[] = []
  const say = (line = ''): void => {
    out.push(line)
  }

  for (const [label, dir] of [
    ['baseline', opts.baseline],
    ['candidate', opts.candidate],
  ] as const) {
    if (!(await dirExists(dir))) {
      process.stderr.write(`parity: ${label} directory does not exist: ${dir}\n`)
      return 2
    }
  }

  const [baselinePaths, candidatePaths] = await Promise.all([
    walk(opts.baseline),
    walk(opts.candidate),
  ])
  const baseSet = new Set(baselinePaths)
  const candSet = new Set(candidatePaths)

  const missingContent: Finding[] = []
  const extraContent: Finding[] = []
  const missingAssets: Finding[] = []
  const extraAssets: Finding[] = []

  for (const path of baselinePaths) {
    if (candSet.has(path)) continue
    ;(isBundleAsset(path) ? missingAssets : missingContent).push({ file: path, detail: '' })
  }
  for (const path of candidatePaths) {
    if (baseSet.has(path)) continue
    ;(isBundleAsset(path) ? extraAssets : extraContent).push({ file: path, detail: '' })
  }

  const common = baselinePaths.filter((path) => candSet.has(path) && !isBundleAsset(path))
  const htmlPaths = common.filter((path) => path.endsWith('.html'))
  const jsonPaths = common.filter((path) => path.endsWith('.json'))

  const headFindings: Finding[] = []
  const jsonLdFindings: Finding[] = []
  const mainTextFindings: Finding[] = []
  const jsonFindings: Finding[] = []
  const llmsFindings: Finding[] = []
  const perPageDiffs = new Map<string, number>()
  let pagesWithoutMain = 0
  let pagesWithIslandsStripped = 0
  let islandSubtreesStripped = 0
  let pagesGrownAppendOnly = 0
  let charsInserted = 0

  const bump = (file: string, by: number): void => {
    perPageDiffs.set(file, (perPageDiffs.get(file) ?? 0) + by)
  }

  await mapLimit(htmlPaths, 24, async (path) => {
    const [baselineHtml, candidateHtml] = await Promise.all([
      readText(join(opts.baseline, path)),
      readText(join(opts.candidate, path)),
    ])

    const headDiffs = compareHeadMeta(extractHeadMeta(baselineHtml), extractHeadMeta(candidateHtml))
    if (headDiffs.length > 0) {
      headFindings.push({ file: path, detail: headDiffs.join('\n') })
      bump(path, headDiffs.length)
    }

    const ldDiffs = compareJsonLd(extractJsonLd(baselineHtml), extractJsonLd(candidateHtml))
    if (ldDiffs.length > 0) {
      jsonLdFindings.push({ file: path, detail: ldDiffs.join('\n') })
      bump(path, ldDiffs.length)
    }

    const baselineMain = extractMainInner(baselineHtml)
    const candidateMain = extractMainInner(candidateHtml)
    if (baselineMain === null && candidateMain === null) {
      pagesWithoutMain += 1
      return
    }
    if (baselineMain === null || candidateMain === null) {
      mainTextFindings.push({
        file: path,
        detail: `<main> present in ${baselineMain === null ? 'candidate' : 'baseline'} only`,
      })
      bump(path, 1)
      return
    }

    const prepare = (html: string): { text: string; stripped: number } => {
      let work = removeBlocks(removeBlocks(html, 'script'), 'style')
      work = removeComments(work)
      let stripped = 0
      if (opts.ignoreIslandText) {
        const result = stripNonSsrIslands(work)
        work = result.html
        stripped = result.count
      }
      return { text: normalizeText(work), stripped }
    }

    const a = prepare(baselineMain)
    const b = prepare(candidateMain)
    const stripped = a.stripped + b.stripped
    if (stripped > 0) {
      pagesWithIslandsStripped += 1
      islandSubtreesStripped += stripped
    }

    if (a.text !== b.text) {
      // An append-only page passes only if every character the baseline emitted
      // survives, in order, with the growth confined to one insertion. A real
      // regression on such a page still fails, in the else branch below.
      //
      // Deliberately if/else rather than an early `return`: this is currently
      // the last comparison in the callback, so returning would be equivalent —
      // but only by accident. Any check added after this point would then be
      // silently skipped for exactly the pages carrying an exemption, which is
      // the worst possible set to skip.
      const isTolerableGrowth = APPEND_ONLY_PAGES.has(path) && isInsertionOf(a.text, b.text)
      if (isTolerableGrowth) {
        pagesGrownAppendOnly += 1
        charsInserted += b.text.length - a.text.length
      } else {
        const excerpt = textExcerpt(a.text, b.text)
        mainTextFindings.push({
          file: path,
          detail: [
            `first difference at char ${excerpt.at} (baseline ${a.text.length} chars, candidate ${b.text.length} chars)`,
            `baseline : ${excerpt.baseline}`,
            `candidate: ${excerpt.candidate}`,
            ...(APPEND_ONLY_PAGES.has(path)
              ? [
                  'this page is append-only, so it was compared under isInsertionOf',
                  'rather than equality — it failed that too, meaning baseline',
                  'content was removed, reordered or reworded. A real finding.',
                ]
              : []),
          ].join('\n'),
        })
        bump(path, 1)
      }
    }
  })

  await mapLimit(jsonPaths, 24, async (path) => {
    const [rawA, rawB] = await Promise.all([
      readText(join(opts.baseline, path)),
      readText(join(opts.candidate, path)),
    ])
    let valueA: unknown
    let valueB: unknown
    try {
      valueA = JSON.parse(rawA)
    } catch (error) {
      jsonFindings.push({ file: path, detail: `baseline is not valid JSON: ${String(error)}` })
      return
    }
    try {
      valueB = JSON.parse(rawB)
    } catch (error) {
      jsonFindings.push({ file: path, detail: `candidate is not valid JSON: ${String(error)}` })
      return
    }
    const diff = firstJsonDiff(valueA, valueB)
    if (diff) {
      jsonFindings.push({
        file: path,
        detail: `differs at ${diff.path}\n  baseline : ${diff.baseline}\n  candidate: ${diff.candidate}`,
      })
    }
  })

  if (baseSet.has('llms.txt') && candSet.has('llms.txt')) {
    const [a, b] = await Promise.all([
      Bun.file(join(opts.baseline, 'llms.txt')).arrayBuffer(),
      Bun.file(join(opts.candidate, 'llms.txt')).arrayBuffer(),
    ])
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (!bufA.equals(bufB)) {
      const textA = bufA.toString('utf8')
      const textB = bufB.toString('utf8')
      const excerpt = textExcerpt(textA, textB, 80)
      llmsFindings.push({
        file: 'llms.txt',
        detail: [
          `not byte-identical (baseline ${bufA.length} bytes, candidate ${bufB.length} bytes)`,
          `first difference at char ${excerpt.at}`,
          `baseline : ${JSON.stringify(excerpt.baseline)}`,
          `candidate: ${JSON.stringify(excerpt.candidate)}`,
        ].join('\n'),
      })
    }
  } else if (baseSet.has('llms.txt') !== candSet.has('llms.txt')) {
    llmsFindings.push({
      file: 'llms.txt',
      detail: `present in ${baseSet.has('llms.txt') ? 'baseline' : 'candidate'} only`,
    })
  }

  const categories: Category[] = [
    {
      name: 'file set — missing from candidate',
      fatal: true,
      findings: missingContent,
    },
    {
      name: 'file set — extra in candidate',
      fatal: true,
      findings: extraContent,
    },
    {
      name: 'file set — hashed bundle output',
      fatal: opts.strictAssets,
      findings: [
        ...missingAssets.map((f) => ({ file: f.file, detail: 'baseline only' })),
        ...extraAssets.map((f) => ({ file: f.file, detail: 'candidate only' })),
      ],
      note: opts.strictAssets
        ? 'fatal (--strict-assets)'
        : 'informational: content-hashed filenames and chunk layout legitimately differ; re-run with --strict-assets to enforce',
    },
    {
      name: 'head metadata (title/description/canonical/og/twitter/robots)',
      fatal: true,
      findings: headFindings,
    },
    { name: 'JSON-LD blocks', fatal: true, findings: jsonLdFindings },
    { name: '<main> visible text', fatal: true, findings: mainTextFindings },
    { name: 'JSON endpoints', fatal: true, findings: jsonFindings },
    { name: 'llms.txt (byte-identical)', fatal: true, findings: llmsFindings },
  ]

  // -- report ---------------------------------------------------------------

  say('srd SSG parity gate')
  say('===================')
  say(`  baseline : ${opts.baseline}`)
  say(`  candidate: ${opts.candidate}`)
  say(
    `  options  : ignore-island-text=${opts.ignoreIslandText} strict-assets=${opts.strictAssets} limit=${opts.limit}`
  )
  say()
  say('Scope')
  say(`  files in baseline      : ${baselinePaths.length}`)
  say(`  files in candidate     : ${candidatePaths.length}`)
  say(`  HTML pages compared    : ${htmlPaths.length}`)
  say(`  JSON endpoints compared: ${jsonPaths.length}`)
  say(`  pages with no <main>   : ${pagesWithoutMain} (both sides — not a difference)`)
  if (pagesGrownAppendOnly > 0) {
    say(
      `  append-only growth on  : ${pagesGrownAppendOnly} page(s), +${charsInserted} chars inserted ` +
        `(all baseline content intact and in order — see APPEND_ONLY_PAGES)`
    )
  }
  if (opts.ignoreIslandText) {
    say(
      `  island text ignored on : ${pagesWithIslandsStripped} pages (${islandSubtreesStripped} ssr:false island subtrees excluded across both sides)`
    )
  } else {
    say('  island text ignored on : 0 pages (--no-ignore-island-text)')
  }
  say()
  say('Results')

  let fatalCount = 0
  for (const category of categories) {
    const count = category.findings.length
    if (count > 0 && category.fatal) fatalCount += count
    const status = count === 0 ? 'PASS' : category.fatal ? 'FAIL' : 'WARN'
    const suffix = category.note && count > 0 ? `  [${category.note}]` : ''
    say(`  [${status}] ${category.name}: ${count} mismatch${count === 1 ? '' : 'es'}${suffix}`)
    if (count > 0) {
      for (const line of listExamples(category.findings, opts.limit)) say(line)
    }
  }

  const worst = [...perPageDiffs.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  if (worst.length > 0) {
    say()
    say(
      `Worst offenders (${worst.length} page${worst.length === 1 ? '' : 's'} with at least one difference)`
    )
    for (const [file, count] of worst.slice(0, opts.limit)) {
      say(`  ${String(count).padStart(4)}  ${file}`)
    }
    if (worst.length > opts.limit) say(`  … and ${worst.length - opts.limit} more`)
  }

  say()
  if (fatalCount === 0) {
    say(
      `PARITY OK — ${htmlPaths.length} pages, ${jsonPaths.length} JSON endpoints, zero differences.`
    )
  } else {
    say(
      `PARITY FAILED — ${fatalCount} mismatch${fatalCount === 1 ? '' : 'es'} across ${worst.length} page(s)/file(s).`
    )
  }

  process.stdout.write(`${out.join('\n')}\n`)
  return fatalCount === 0 ? 0 : 1
}

if (import.meta.main) {
  process.exit(await run(parseArgs(process.argv.slice(2))))
}
