/**
 * htmlDigest — tolerant, dependency-free scanning of built HTML.
 *
 * This is the analysis half of the retired `ssg/parity.ts`, recovered rather
 * than rewritten. What rotted about parity was its BASELINE (an unregenerable
 * Astro-era `dist`), not its extraction: every routine below carries a comment
 * describing a real bug that was hit and fixed while diffing 1,039 real pages,
 * and rewriting from scratch would have reintroduced them one at a time.
 *
 * `ssg/snapshot.ts` is the consumer — the gate that replaced parity.
 *
 * Deliberately parser-free: `apps/srd` has no HTML-parsing dependency and this
 * runs over ~18 MB of output, so these are hand-rolled scanners tolerant of the
 * malformed-but-legal markup browsers accept.
 *
 * NOT recovered from parity.ts, because both existed only to compare TWO
 * DIFFERENT generators and are meaningless against our own output:
 *   - `stripNonSsrIslands` / `NON_SSR_ISLANDS` — masked Astro server-rendering
 *     island markup the new SSG mounts client-side. Snapshotting our own build
 *     wants that markup captured, not hidden.
 *   - `isBundleAsset`'s Astro arms (`_astro/`), and the whole `--strict-assets`
 *     notion of a tolerated path-set difference.
 */

import { createHash } from 'node:crypto'

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
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

// ---------------------------------------------------------------------------
// Tolerant tag scanning
// ---------------------------------------------------------------------------

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
 * digest that is not a cosmetic bug: dropping too much of a page's `<main>`
 * is exactly how a real content regression hashes as unchanged.
 */
export const removeBlocks = (html: string, tagName: string): string =>
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
export const removeComments = (html: string): string => {
  let out = html
  for (;;) {
    const next = out.replace(/<!--[\s\S]*?--!?>/g, '')
    if (next === out) break
    out = next
  }
  return out.replace(/<!--[\s\S]*$/, '')
}

export const normalizeText = (html: string): string =>
  decodeEntities(html.replace(ANY_TAG_RE, ' '))
    .replace(/[\s\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000\ufeff]+/g, ' ')
    .trim()

/**
 * The visible text of a page's `<main>`, normalized — or null when the page has
 * no `<main>` at all (the two `bare` document pages, `greembeem` and `og-card`).
 */
export const mainText = (html: string): string | null => {
  const inner = extractMainInner(html)
  if (inner === null) return null
  return normalizeText(removeComments(removeBlocks(removeBlocks(inner, 'script'), 'style')))
}

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

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

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

/** The `@type` of each JSON-LD block, in document order. Unparseable → `!invalid`. */
export const jsonLdTypes = (html: string): string[] =>
  extractJsonLd(html).map((block) => {
    if (!block.ok) return '!invalid'
    const value = block.value
    if (typeof value === 'object' && value !== null && '@type' in value) {
      const type = (value as Record<string, unknown>)['@type']
      return typeof type === 'string' ? type : canonicalize(type)
    }
    return '!untyped'
  })

// ---------------------------------------------------------------------------
// Canonical form + hashing
// ---------------------------------------------------------------------------

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Key-order-insensitive canonical form.
 *
 * Hashing `JSON.stringify(value)` directly would make the digest depend on key
 * INSERTION order, so a pure refactor that builds the same object differently
 * would fail the gate. A gate that fires on non-changes gets disabled.
 */
export const canonicalize = (value: unknown): string => {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/**
 * Short content hash. sha256 rather than `Bun.hash` because this value is
 * COMMITTED: it has to be reproducible across machines and across Bun versions,
 * and a non-cryptographic hash carries no such promise.
 */
export const digest = (input: string): string =>
  createHash('sha256').update(input).digest('hex').slice(0, 16)

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
