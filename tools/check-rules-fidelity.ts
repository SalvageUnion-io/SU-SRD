/**
 * Compares every prose string in the reference dataset with the rulebook it
 * transcribes, and records a verdict for each in
 * `packages/salvageunion-reference/fidelity.lock.json`.
 *
 * The package rule is that descriptions and effects are copied verbatim. Until
 * this check, nothing compared the prose with the books: a deep-dive audit
 * (2026-10) found about 86% of checkable prose verbatim and the rest drifted
 * silently — paraphrases, dropped clauses, Americanised spellings, text cited
 * to the wrong book. The books cannot reach CI (they are gitignored, copyright-
 * bearing PDFs), so the work is split:
 *
 *   - THIS script runs locally, where `bun run rules:extract` has produced the
 *     text layers. It classifies every string and, with `--update`, writes the
 *     lock: a hash of each string's text plus its verdict, and no book text.
 *   - `check-fidelity-lock.ts`, the CI gate, needs no book. It fails when a
 *     string's hash has no lock entry, so any prose edit forces a local
 *     re-verification here.
 *
 * Verdicts:
 *
 *   verbatim           matches the book (whitespace and typography folded;
 *                      `elsewhere` / `other-book` when not where it is cited;
 *                      `artefact` when only PDF text-layer noise differs)
 *   deviation          differs only in a way the allowlist names
 *                      (`lib/proseDeviations.ts`)
 *   authored           text the dataset writes itself (allowlist rules)
 *   unverified         a near-miss or a miss: real drift, recorded with its
 *                      class (paraphrase, omission, …) and left for a prose fix
 *   unverified-source  no local text for any book the string cites
 *
 * Unverified is recorded, not blocked: the lock is a ledger of what has been
 * checked, and the drift in it is a to-do list for prose fixes.
 *
 * ## Matching
 *
 * Each book is read in two text layers (see `extract-rules.ts`): poppler's
 * reading order, and content-stream order (`-raw`), which keeps a paragraph
 * whole where the reading order interleaves two columns, a sidebar or a stat
 * line into it. A string is searched near its cited page in every layer at
 * increasingly lenient tiers — whitespace, typographic fold, line-break
 * hyphen join, case, then a punctuation-free skeleton — then anywhere in
 * every book. A miss is aligned token-by-token against the likeliest passage
 * and the differences classified.
 *
 * Books are matched by FILENAME PATTERN, so a new edition dropped into
 * `rules/` is picked up without a code change (the latest by version wins).
 *
 * Requires the gitignored extract: `bun run rules:extract`. With none present
 * this exits 0 with a notice, like `check-printed-names.ts`: a local check,
 * not a CI gate. In a git worktree, which has no gitignored files, it reads
 * the main checkout's `rules/` (or `RULES_EXTRACT_DIR`).
 *
 * Run:  bun tools/check-rules-fidelity.ts            # verify; report what the lock would change
 *       bun tools/check-rules-fidelity.ts --update   # ... and rewrite the lock
 *       bun tools/check-rules-fidelity.ts --show=paraphrase,omission   # list those, with diffs
 *       bun tools/check-rules-fidelity.ts --summary  # drift summary as markdown (no book text)
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import type { ProseRuleId } from '../packages/salvageunion-reference/lib/proseDeviations'
import {
  BOILERPLATE_MIN_REPEATS,
  BOOK_TYPOS,
  CHASSIS_PLACEHOLDERS,
  CHASSIS_STAND_INS,
  NAME_DEVIATIONS,
  OWNER_SUFFIX,
  TRAIT_MARKUP,
} from '../packages/salvageunion-reference/lib/proseDeviations'
import type { Layer } from './extract-rules'
import { LAYER_DIR } from './extract-rules'
import type { Anchor, Lock, LockEntry, ProseItem, Reason } from './lib/proseFidelity'
import {
  collectProse,
  compareWithLock,
  DRIFT_REASONS,
  fold,
  proseHash,
  readLockFile,
  toLockFile,
  VERDICTS,
  writeLockFile,
} from './lib/proseFidelity'

// ---------------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------------

type BookSpec = {
  /** Label used in output and in the lock's `editions`. */
  id: string
  /** The extract, matched by filename so a new edition needs no code change. */
  file: RegExp
  /**
   * The data anchors this book answers for. Empty: a fallback-only text.
   * `partial`: the anchor also covers material with no local text, so a miss
   * there is `unverified-source`, not drift.
   */
  answers: { source: string; booklet?: string; partial?: boolean }[]
  /** Load every matching file (a series of one-off PDFs), not only the latest edition. */
  series?: boolean
  /**
   * For a series whose files each cover one thing: the entity a file covers,
   * from its name. A record of that series is verifiable only when a file
   * covers it (or what owns it); the series' other files are still searched.
   */
  scopeOf?: (file: string) => string | undefined
}

const STARTER = 'Salvage Union Starter Set'
const BOOK_SPECS: BookSpec[] = [
  {
    id: 'Core Book',
    // Anchored: the expansions share the "Digital Edition" suffix.
    file: /^salvage union digital edition/i,
    answers: [{ source: 'Salvage Union Workshop Manual' }],
  },
  { id: 'False Flag', file: /^false flag/i, answers: [{ source: 'False Flag' }] },
  { id: 'Rainmaker', file: /^rainmaker/i, answers: [{ source: 'Rainmaker' }] },
  {
    id: 'We Were Here First!',
    file: /^we were here first/i,
    answers: [{ source: 'We Were Here First!' }],
  },
  {
    id: 'Reclamation of the Wastes',
    file: /^reclamation of the wastes/i,
    answers: [{ source: 'Reclamation of the Wastes' }],
  },
  // The Starter Set is five booklets, each paginated from 1, so `booklet` picks
  // the text. Its Asset Pack ("AP") holds the three adventure booklets, each
  // also sold on its own, and a deck of item cards that has no local text.
  {
    id: 'Mech Monday',
    file: /^mech monday/i,
    // One file per chassis ("Mech Monday Mule Patterns", "… Goliath Template"),
    // plus the transcribed blog posts. A chassis with no file of its own (the
    // Scrapper patterns survive only as an image) stays unverified-source.
    answers: [{ source: 'Mech Monday' }],
    series: true,
    scopeOf: (file) =>
      file.match(/^mech monday (.+?) (?:patterns|template)\b/i)?.[1]?.toLowerCase(),
  },
  {
    id: 'SUSS Core Rulebook',
    file: /^suss core rulebook/i,
    answers: [{ source: STARTER, booklet: 'CR' }],
  },
  {
    id: 'SUSS Pilots Handbook',
    file: /^suss pilots handbook/i,
    answers: [{ source: STARTER, booklet: 'PH' }],
  },
  {
    id: 'SUSS Parts Catalogue',
    file: /^suss parts catalogue/i,
    answers: [{ source: STARTER, booklet: 'PC' }],
  },
  {
    id: 'SUSS Rules Reference',
    file: /^suss rules reference/i,
    answers: [{ source: STARTER, booklet: 'RR' }],
  },
  {
    id: 'Relics of a Time Gone By',
    file: /^relics of a time gone by/i,
    answers: [
      { source: 'Relics of a Time Gone By' },
      { source: STARTER, booklet: 'AP', partial: true },
    ],
  },
  {
    id: "Thatcher's Mech Base",
    file: /^thatcher'?s mech base/i,
    answers: [
      { source: "Thatcher's Mech Base" },
      { source: STARTER, booklet: 'AP', partial: true },
    ],
  },
  {
    id: 'The Hive',
    file: /^the hive/i,
    answers: [{ source: 'The Hive' }, { source: STARTER, booklet: 'AP', partial: true }],
  },
  // Reprint core text; searched only as a fallback, never cited.
  { id: 'Quick Ref Sheets', file: /^su_quick ref sheets digital/i, answers: [] },
  { id: 'Quickstart', file: /^salvage union quickstart/i, answers: [] },
]

/** A cited page and its neighbours: a paragraph may run over a page break. */
const NEAR = 2

/** Text views, each more lenient than the last. */
type View = 'ws' | 'typo' | 'hyph' | 'case' | 'skel'
const VIEWS: View[] = ['ws', 'typo', 'hyph', 'case', 'skel']

const ws = (s: string) => s.replace(/\s+/g, ' ').trim()
function view(s: string, v: View, bookSide: boolean): string {
  if (v === 'ws') return ws(s)
  let t = fold(s)
  // keep a genuine compound split across lines ("Mech-\nTech"); later tiers join it
  if (bookSide) t = t.replace(/-[ \t]*\n\s*/g, v === 'typo' ? '-' : '')
  t = t.replace(/\s*-\s*/g, '-')
  if (v === 'typo' || v === 'hyph') return ws(t)
  if (v === 'case') return ws(t).toLowerCase()
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

type Book = {
  spec: BookSpec
  /** The entity this file covers, for a scoped series (`BookSpec.scopeOf`). */
  scope?: string
  layer: Layer
  pages: Map<number, string>
  views: Map<View, { text: string; starts: number[]; nums: number[] }>
  tokens: string[]
  rawTokens: string[]
  tokPage: number[]
  /** page -> [first token, last token + 1) */
  pageTok: Map<number, [number, number]>
  gram: Map<string, number[]>
  /** 1 = a layout glyph token (stamp letter, stat digit): free to skip in alignment */
  noise: Uint8Array
}

const TOKEN_RE = /[A-Za-z0-9]+/g
/** Upper-case tokens that are words, not rotated stamp letters. */
const REAL_CAPS = new Set(['A', 'I', 'AP', 'EP', 'SP', 'HP', 'TL', 'OR', 'NPC'])
const isGlyph = (r: string) =>
  (/^[A-Z]{1,3}$/.test(r) && !REAL_CAPS.has(r)) || /^\d+$/.test(r) || /^T\d$/.test(r)

function pageOfPos(starts: number[], nums: number[], pos: number): number {
  let lo = 0
  let hi = starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if ((starts[mid] ?? 0) <= pos) lo = mid
    else hi = mid - 1
  }
  return nums[lo] ?? -1
}

function loadBook(spec: BookSpec, layer: Layer, path: string): Book {
  const parts = readFileSync(path, 'utf8').split(/<!-- page (\d+) -->/)
  const pages = new Map<number, string>()
  // Lines that are only a page number, a slot/tech digit, a rotated stamp letter
  // or two, or a "T2" tech tag are layout glyphs. Dropping them is a PDF-side
  // clean-up, never a data one.
  const GLYPH = /^\s*(\d{1,3}|(?![AI]$)[A-Z]{1,3}|T\d|[×x] _)\s*$/
  for (let i = 1; i < parts.length; i += 2)
    pages.set(
      Number(parts[i]),
      (parts[i + 1] ?? '')
        .split('\n')
        .filter((l) => !GLYPH.test(l))
        .join('\n')
    )
  const views = new Map<View, { text: string; starts: number[]; nums: number[] }>()
  for (const v of VIEWS) {
    let text = ''
    const starts: number[] = []
    const nums: number[] = []
    for (const [n, t] of pages) {
      starts.push(text.length)
      nums.push(n)
      const piece = view(`${t}\n`, v, true)
      text += v === 'skel' ? piece : `${piece} `
    }
    views.set(v, { text, starts, nums })
  }
  const tokens: string[] = []
  const rawTokens: string[] = []
  const tokPage: number[] = []
  const pageTok = new Map<number, [number, number]>()
  for (const [n, t] of pages) {
    const lo = tokens.length
    for (const m of fold(t).matchAll(TOKEN_RE)) {
      tokens.push(m[0].toLowerCase())
      rawTokens.push(m[0])
      tokPage.push(n)
    }
    pageTok.set(n, [lo, tokens.length])
  }
  const gram = new Map<string, number[]>()
  for (let i = 0; i + 1 < tokens.length; i++) {
    const k = `${tokens[i]} ${tokens[i + 1]}`
    const l = gram.get(k)
    if (l) l.push(i)
    else gram.set(k, [i])
  }
  const noise = new Uint8Array(tokens.length)
  rawTokens.forEach((r, i) => {
    if (isGlyph(r)) noise[i] = 1
  })
  const scope = spec.scopeOf?.(basename(path))
  return {
    spec,
    ...(scope ? { scope } : {}),
    layer,
    pages,
    views,
    tokens,
    rawTokens,
    tokPage,
    pageTok,
    gram,
    noise,
  }
}

/** Token range of pages [page - NEAR, page + NEAR]. */
function pageWindow(b: Book, page: number): [number, number] {
  let lo = -1
  let hi = -1
  for (let p = page - NEAR; p <= page + NEAR; p++) {
    const r = b.pageTok.get(p)
    if (!r || r[0] === r[1]) continue
    if (lo < 0) lo = r[0]
    hi = r[1]
  }
  return [lo, hi]
}

// ---------------------------------------------------------------------------
// Locating the extract
// ---------------------------------------------------------------------------

const REPO = join(import.meta.dir, '..')

/** `rules/extracted`, here or — in a worktree, which has no gitignored files — in the main checkout. */
function findExtractDir(): string | undefined {
  const candidates = [process.env.RULES_EXTRACT_DIR, join(REPO, 'rules/extracted')]
  const common = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    cwd: REPO,
    encoding: 'utf8',
  })
  if (common.status === 0 && common.stdout.trim())
    candidates.push(join(dirname(common.stdout.trim()), 'rules/extracted'))
  return candidates.find((d): d is string => !!d && existsSync(d))
}

/**
 * The extract(s) for each book present: the latest edition (names compared
 * with numeric collation), or for a series every file.
 */
function pickFiles(dir: string): Map<BookSpec, string[]> {
  const files = readdirSync(dir).filter((f) => f.endsWith('.txt'))
  const out = new Map<BookSpec, string[]>()
  for (const spec of BOOK_SPECS) {
    const found = files
      .filter((f) => spec.file.test(f))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    if (found.length) out.set(spec, spec.series ? found.reverse() : found.slice(0, 1))
  }
  return out
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

type Kind = ProseItem['kind']
type Hit = { tier: View; book: Book; near: boolean; page: number }

function findIn(text: string, needle: string, kind: Kind, v: View): number {
  if (!needle) return -1
  if (kind === 'name' && v !== 'skel') {
    // whole-word for names, so "Arm" does not match "Armour"
    let from = 0
    for (;;) {
      const i = text.indexOf(needle, from)
      if (i < 0) return -1
      const before = text[i - 1] ?? ' '
      const after = text[i + needle.length] ?? ' '
      if (!/[A-Za-z0-9]/.test(before) && !/[A-Za-z0-9]/.test(after)) return i
      from = i + 1
    }
  }
  return text.indexOf(needle)
}

class Library {
  /** Every loaded layer of every book. */
  readonly all: Book[]
  private readonly byAnchor = new Map<string, Book[]>()

  constructor(books: Book[]) {
    this.all = books
    for (const b of books)
      for (const a of b.spec.answers) {
        const k = `${a.source}|${a.booklet ?? ''}`
        this.byAnchor.set(k, [...(this.byAnchor.get(k) ?? []), b])
      }
  }

  /** The layers that hold an anchor's text. An anchor with no booklet takes every booklet. */
  booksFor(a: Anchor): Book[] {
    const exact = this.byAnchor.get(`${a.source}|${a.booklet ?? ''}`)
    if (exact) return exact
    if (a.booklet) return []
    return this.all.filter((b) => b.spec.answers.some((x) => x.source === a.source))
  }

  /**
   * Does local text cover everything this anchor can cite, for a record about
   * `scopes` (its entity's name and its owners')?
   */
  isLocal(a: Anchor, scopes: string[]): boolean {
    const wanted = new Set(scopes.map((s) => s.toLowerCase()))
    return this.booksFor(a).some(
      (b) =>
        (!b.spec.scopeOf || (b.scope !== undefined && wanted.has(b.scope))) &&
        b.spec.answers.some(
          (x) =>
            x.source === a.source &&
            (x.booklet ?? '') === (a.booklet ?? x.booklet ?? '') &&
            !x.partial
        )
    )
  }
}

function nearText(b: Book, page: number, v: View): string {
  let t = ''
  for (let p = page - NEAR; p <= page + NEAR; p++) {
    const pt = b.pages.get(p)
    if (pt !== undefined) t += `${pt}\n`
  }
  return view(t, v, true)
}

function search(lib: Library, text: string, kind: Kind, anchors: Anchor[]): Hit | undefined {
  const cited = anchors.flatMap((a) => lib.booksFor(a).map((book) => ({ book, page: a.page })))
  const skelLen = view(text, 'skel', false).length
  const usable = (tier: View) => tier !== 'skel' || (kind === 'prose' && skelLen >= 20)
  // near a cited page first, in every layer, at every tier
  for (const tier of VIEWS) {
    if (!usable(tier)) continue
    const needle = view(text, tier, false)
    for (const c of cited) {
      if (c.page === undefined) continue
      if (findIn(nearText(c.book, c.page, tier), needle, kind, tier) < 0) continue
      let page = c.page
      for (let p = c.page - NEAR; p <= c.page + NEAR; p++) {
        const pt = c.book.pages.get(p)
        if (pt !== undefined && findIn(view(pt, tier, true), needle, kind, tier) >= 0) {
          page = p
          break
        }
      }
      return { tier, book: c.book, near: true, page }
    }
  }
  // then anywhere: cited books first, then every other (text reprinted or mis-cited)
  const citedBooks = [...new Set(cited.map((c) => c.book))]
  const order = [...citedBooks, ...lib.all.filter((b) => !citedBooks.includes(b))]
  for (const tier of VIEWS) {
    if (!usable(tier)) continue
    const needle = view(text, tier, false)
    for (const b of order) {
      const vv = b.views.get(tier)
      if (!vv) continue
      const i = findIn(vv.text, needle, kind, tier)
      if (i >= 0) return { tier, book: b, near: false, page: pageOfPos(vv.starts, vv.nums, i) }
    }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Fuzzy alignment
// ---------------------------------------------------------------------------

type Op = { op: '=' | 'sub' | 'del' | 'ins'; d?: string; b?: string; bi?: number; di?: number }
type Fuzzy = { score: number; book: Book; page: number; ops: Op[]; bStart: number; bEnd: number }

function tokensOf(s: string): string[] {
  return [...fold(s).matchAll(TOKEN_RE)].map((m) => m[0].toLowerCase())
}

/** Semi-global alignment: all of D against a free-ended slice of B[w0..w1). */
function align(D: string[], B: string[], w0: number, w1: number, noise: Uint8Array) {
  const m = D.length
  const n = w1 - w0
  const W = n + 1
  const dp = new Int32Array((m + 1) * W)
  const at = (i: number, j: number) => dp[i * W + j] ?? 0
  for (let i = 1; i <= m; i++) dp[i * W] = i
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const sub = at(i - 1, j - 1) + (D[i - 1] === B[w0 + j - 1] ? 0 : 1)
      const del = at(i - 1, j) + 1 // data token not in the book
      const ins = at(i, j - 1) + (noise[w0 + j - 1] ? 0 : 1) // book token not in the data
      dp[i * W + j] = Math.min(sub, del, ins)
    }
  }
  let best = Number.POSITIVE_INFINITY
  let bj = 0
  for (let j = 0; j <= n; j++)
    if (at(m, j) < best) {
      best = at(m, j)
      bj = j
    }
  const ops: Op[] = []
  let i = m
  let j = bj
  while (i > 0) {
    const cur = at(i, j)
    const same = D[i - 1] === B[w0 + j - 1]
    if (j > 0 && cur === at(i - 1, j - 1) + (same ? 0 : 1)) {
      ops.push({ op: same ? '=' : 'sub', d: D[i - 1], b: B[w0 + j - 1], bi: w0 + j - 1, di: i - 1 })
      i--
      j--
    } else if (cur === at(i - 1, j) + 1) {
      ops.push({ op: 'del', d: D[i - 1], di: i - 1 })
      i--
    } else if (j > 0) {
      ops.push({ op: 'ins', b: B[w0 + j - 1], bi: w0 + j - 1 })
      j--
    } else break
  }
  ops.reverse()
  return { cost: best, ops, s: w0 + j, e: w0 + bj }
}

/** Best alignment of `text` in `books`, preferring the cited page unless elsewhere is clearly better. */
function fuzzy(text: string, books: Book[], cited: Map<Book, number>): Fuzzy | undefined {
  const D = tokensOf(text)
  if (D.length < 3) return undefined
  let best: Fuzzy | undefined
  let bestNear: Fuzzy | undefined
  const consider = (b: Book, w0: number, w1: number, forceNear: boolean) => {
    const a = align(D, b.tokens, w0, w1, b.noise)
    const score = 1 - a.cost / D.length
    const page = b.tokPage[a.s] ?? -1
    const c = cited.get(b)
    const isNear = forceNear || (c !== undefined && Math.abs(page - c) <= NEAR)
    const cand = { score, book: b, page, ops: a.ops, bStart: a.s, bEnd: a.e }
    if (!best || score > best.score) best = cand
    if (isNear && (!bestNear || score > bestNear.score)) bestNear = cand
  }
  for (const b of books) {
    // diagonal voting with bigrams
    const votes = new Map<number, number>()
    for (let i = 0; i + 1 < D.length; i++) {
      const l = b.gram.get(`${D[i]} ${D[i + 1]}`)
      if (!l || l.length > 400) continue
      for (const p of l) {
        const diag = Math.round((p - i) / 4) * 4
        votes.set(diag, (votes.get(diag) ?? 0) + 1)
      }
    }
    const c = cited.get(b)
    const diags = [...votes]
      .map(([d, n]) => {
        const pg = b.tokPage[Math.max(0, d)] ?? -1
        return [d, n * (c !== undefined && Math.abs(pg - c) <= NEAR ? 1.5 : 1)] as const
      })
      .sort((x, y) => y[1] - x[1] || x[0] - y[0])
      .slice(0, 4)
    // always try the cited window itself, whatever the votes say
    if (c !== undefined) {
      const [lo, hi] = pageWindow(b, c)
      if (lo >= 0) consider(b, lo, hi, true)
    }
    for (const [d] of diags) {
      const slack = Math.max(10, Math.ceil(D.length * 0.5))
      consider(b, Math.max(0, d - slack), Math.min(b.tokens.length, d + D.length + slack), false)
    }
  }
  // Books reprint near-identical text (a System and the Chassis ability built
  // from it); the cited one is the one to compare.
  const n = bestNear as Fuzzy | undefined
  const a = best as Fuzzy | undefined
  if (n && a && n.score >= a.score - 0.1) return n
  return a
}

// ---------------------------------------------------------------------------
// Classifying a near-miss
// ---------------------------------------------------------------------------

const BRIT: [RegExp, string][] = [
  [/our$/, 'or'],
  [/ours$/, 'ors'],
  [/oured$/, 'ored'],
  [/ise$/, 'ize'],
  [/ised$/, 'ized'],
  [/ises$/, 'izes'],
  [/ising$/, 'izing'],
  [/isation$/, 'ization'],
  [/isations$/, 'izations'],
  [/yse$/, 'yze'],
  [/ysed$/, 'yzed'],
  [/tre$/, 'ter'],
  [/tres$/, 'ters'],
  [/ence$/, 'ense'],
  [/lled$/, 'led'],
  [/lling$/, 'ling'],
  [/ogue$/, 'og'],
  [/^grey/, 'gray'],
  [/^manoeuv/, 'maneuv'],
  [/^aluminium/, 'aluminum'],
  [/^programme/, 'program'],
  [/^tyre/, 'tire'],
]
function american(t: string): string {
  for (const [re, r] of BRIT) if (re.test(t)) return t.replace(re, r)
  return t
}
function lev(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (cur[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    prev = cur
  }
  return prev[b.length] ?? 0
}

/** An op list collapsed into diff hunks (runs of non-'=' ops). */
type Hunk = { d: string[]; b: string[]; bi: number[]; di: number[] }
function hunks(ops: Op[]): Hunk[] {
  const out: Hunk[] = []
  let cur: Hunk | undefined
  for (const o of ops) {
    if (o.op === '=') {
      cur = undefined
      continue
    }
    if (!cur) {
      cur = { d: [], b: [], bi: [], di: [] }
      out.push(cur)
    }
    if (o.d !== undefined && o.op !== 'ins') {
      cur.d.push(o.d)
      if (o.di !== undefined) cur.di.push(o.di)
    }
    if (o.b !== undefined && o.op !== 'del') {
      cur.b.push(o.b)
      if (o.bi !== undefined) cur.bi.push(o.bi)
    }
  }
  return out
}

/** Which data tokens are covered by a 3-gram occurring in book tokens [lo, hi). */
function coverage(D: string[], b: Book, lo: number, hi: number): boolean[] {
  const grams = new Set<string>()
  for (let i = Math.max(0, lo); i + 2 < Math.min(hi, b.tokens.length); i++)
    grams.add(`${b.tokens[i]} ${b.tokens[i + 1]} ${b.tokens[i + 2]}`)
  const cov = D.map(() => false)
  for (let i = 0; i + 2 < D.length; i++)
    if (grams.has(`${D[i]} ${D[i + 1]} ${D[i + 2]}`)) cov[i] = cov[i + 1] = cov[i + 2] = true
  return cov
}

const STAT_WORDS = new Set(
  'turn action actions free reaction passive short long range close medium far cost uses damage tech level slot slots slvg salvage value system module ballistic energy melee hacking hot deadly guided pinning jamming wield overheat burn explosive multi attack heat ep ap sp hp x'.split(
    ' '
  )
)
/** Is this one-word difference a BOOK_TYPOS correction, in the book and near the page it lists? */
function isBookTypo(data: string, printed: string, b: Book, page: number): boolean {
  return BOOK_TYPOS.some(
    (t) =>
      t.corrected.toLowerCase() === data &&
      t.printed.toLowerCase() === printed &&
      Math.abs(t.page - page) <= NEAR &&
      b.spec.answers.some((a) => a.source === t.source)
  )
}

type Drift = (typeof DRIFT_REASONS)[number]
type Classified =
  | { verdict: 'verbatim'; reason: 'artefact' }
  | { verdict: 'deviation'; reason: 'xref-dropped' | 'stat-line' | 'book-typo' }
  | { verdict: 'unverified'; reason: Drift }

function classifyFuzzy(text: string, f: Fuzzy, cited: Map<Book, number>): Classified {
  const b = f.book
  const D = tokensOf(text)
  const c = cited.get(b)
  const [lo, hi] = c !== undefined ? pageWindow(b, c) : [-1, -1]
  const cov = coverage(D, b, lo >= 0 ? lo : f.bStart - 400, hi >= 0 ? hi : f.bEnd + 400)
  // Book-side glyph noise (rotated stamp letters, stat digits, tech tags) is
  // stripped from each hunk; a hunk left empty on both sides was pure noise.
  const H = hunks(f.ops)
    .map((h) => {
      const keep = h.bi.map((i) => !isGlyph(b.rawTokens[i] ?? ''))
      return { ...h, b: h.b.filter((_, k) => keep[k]), bi: h.bi.filter((_, k) => keep[k]) }
    })
    .filter((h) => h.d.length + h.b.length > 0)
  const artefact = (h: Hunk) =>
    // a word split or joined by a line break: book "pre vent", data "prevent"
    (h.d.join('') === h.b.join('') && h.d.length !== h.b.length) ||
    // page-number / running-header noise: book-only tokens spanning a page break
    (h.d.length === 0 &&
      h.bi.length > 0 &&
      (b.tokPage[h.bi[0] ?? 0] !== b.tokPage[h.bi[h.bi.length - 1] ?? 0] ||
        h.b.every(
          (t) => /^\d+$/.test(t) || /^t\d$/.test(t) || t === 'salvage' || t === 'union'
        ))) ||
    // a superscript digit glued into a word: book "scram2 bling"
    h.d.join('') === h.b.join('').replace(/\d+/g, '') ||
    // layout interleave: this hunk's data words DO occur (as 3-grams) near the
    // cited page; the alignment could not reach them because the text layer
    // reordered the columns
    (h.di.length >= 3 && h.di.every((i) => cov[i]) && h.b.length >= 3)
  const real0 = H.filter((h) => !artefact(h))
  if (real0.length === 0) return { verdict: 'verbatim', reason: 'artefact' }
  // book-only stat-line words: held as structured fields, not prose
  const statLine = (h: Hunk) =>
    h.d.length === 0 && h.b.every((t) => STAT_WORDS.has(t) || /^\d+(ap|ep|sp|hp)?$/.test(t))
  const xref = (h: Hunk) =>
    h.d.length === 0 &&
    h.b.includes('p') &&
    h.b.every((t) => t === 'p' || t === 'see' || /^\d+$/.test(t))
  const bookTypo = (h: Hunk) =>
    h.d.length === 1 &&
    h.b.length === 1 &&
    isBookTypo(h.d[0] ?? '', h.b[0] ?? '', b, b.tokPage[h.bi[0] ?? 0] ?? -1)
  const real = real0.filter((h) => !statLine(h) && !xref(h) && !bookTypo(h))
  if (real.length === 0) {
    if (real0.some(bookTypo)) return { verdict: 'deviation', reason: 'book-typo' }
    if (real0.some(xref)) return { verdict: 'deviation', reason: 'xref-dropped' }
    return { verdict: 'deviation', reason: 'stat-line' }
  }
  const spelling = (h: Hunk) =>
    h.d.length === h.b.length &&
    h.d.every((t, i) => american(t) === american(h.b[i] ?? '') && t !== h.b[i])
  if (real.every(spelling)) return { verdict: 'unverified', reason: 'spelling' }
  const typo = (h: Hunk) =>
    spelling(h) ||
    (h.d.length === 1 &&
      h.b.length === 1 &&
      lev(h.d[0] ?? '', h.b[0] ?? '') <= 2 &&
      Math.max((h.d[0] ?? '').length, (h.b[0] ?? '').length) >= 3) ||
    // a dropped or added article, 's', 'a'
    (h.d.length + h.b.length === 1 && (h.d[0] ?? h.b[0] ?? '').length <= 3)
  if (real.every(typo)) return { verdict: 'unverified', reason: 'typo' }
  if (real.every((h) => h.d.length === 0)) {
    // a book-only run that is mostly ALL CAPS is a heading interleaved by the text layer
    const total = real.reduce((n, h) => n + h.b.length, 0)
    const capsy = real.every((h) =>
      h.bi.every((i) => {
        const r = b.rawTokens[i] ?? ''
        return r === r.toUpperCase()
      })
    )
    if (capsy && total >= 2) return { verdict: 'verbatim', reason: 'artefact' }
    return { verdict: 'unverified', reason: 'omission' }
  }
  if (real.every((h) => h.b.length === 0)) return { verdict: 'unverified', reason: 'added-text' }
  return { verdict: 'unverified', reason: 'paraphrase' }
}

function shortDiff(f: Fuzzy): string {
  return hunks(f.ops)
    .filter((h) => !(h.d.join('') === h.b.join('') && h.d.length !== h.b.length))
    .slice(0, 3)
    .map((h) => {
      const braw = h.bi
        .slice(0, 8)
        .map((i) => f.book.rawTokens[i])
        .join(' ')
      const d = h.d.slice(0, 8).join(' ')
      return `data[${d || '∅'}${h.d.length > 8 ? ' …' : ''}] book[${braw || '∅'}${h.bi.length > 8 ? ' …' : ''}]`
    })
    .join(' | ')
}

function sentences(s: string): string[] {
  return s
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
    .map((x) => x.trim())
    .filter((x) => view(x, 'skel', false).length >= 20)
}

// ---------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------

type Result = {
  item: ProseItem
  verdict: LockEntry['verdict']
  reason?: Reason
  book?: string
  page?: number
  score?: number
  diff?: string
}

/** The text with the allowlist's markup rules applied, and which rule each applies. */
function candidates(item: ProseItem): { text: string; rule?: ProseRuleId }[] {
  const out: { text: string; rule?: ProseRuleId }[] = [{ text: item.text }]
  let base = item.text
  const unmarked = base.replace(TRAIT_MARKUP, (m, word: string) =>
    CHASSIS_PLACEHOLDERS.includes(m) ? m : word
  )
  if (unmarked !== base) {
    base = unmarked
    out.push({ text: base, rule: 'trait-markup' })
  }
  if (CHASSIS_PLACEHOLDERS.some((p) => base.includes(p))) {
    const names = [...item.owners.flatMap((o) => [`the ${o}`, o]), ...CHASSIS_STAND_INS]
    for (const n of names)
      out.push({
        text: CHASSIS_PLACEHOLDERS.reduce((t, p) => t.split(p).join(n), base),
        rule: 'chassis-placeholder',
      })
  }
  if (item.kind === 'name') {
    const m = item.text.match(OWNER_SUFFIX)
    if (m?.[1]) out.push({ text: m[1], rule: 'owner-suffix' })
  }
  return out
}

function verify(lib: Library, items: ProseItem[]): Result[] {
  const freq = new Map<string, number>()
  for (const it of items) freq.set(it.text, (freq.get(it.text) ?? 0) + 1)
  const nameDeviations = new Set(NAME_DEVIATIONS.map((d) => d.name))
  const results: Result[] = []

  for (const item of items) {
    const scopes = [item.entityName, ...item.owners]
    const verifiable = item.anchors.some((a) => lib.isLocal(a, scopes))
    const citedBooks = new Set(item.anchors.flatMap((a) => lib.booksFor(a).map((b) => b.spec)))
    const cited = new Map<Book, number>()
    for (const a of item.anchors)
      for (const b of lib.booksFor(a))
        if (a.page !== undefined && !cited.has(b)) cited.set(b, a.page)
    const cands = candidates(item)
    const done = (r: Omit<Result, 'item'>) => results.push({ item, ...r })

    // 1. a match, as written or with a markup rule applied
    let matched = false
    for (const c of cands) {
      const hit = search(lib, c.text, item.kind, item.anchors)
      if (!hit) continue
      const where = { book: hit.book.spec.id, page: hit.page }
      if (c.rule) done({ verdict: 'deviation', reason: c.rule, ...where })
      else if (hit.near) done({ verdict: 'verbatim', ...where })
      else if (citedBooks.size && !citedBooks.has(hit.book.spec))
        done({ verdict: 'verbatim', reason: 'other-book', ...where })
      else if (item.anchors.some((a) => a.page !== undefined) && citedBooks.has(hit.book.spec))
        done({ verdict: 'verbatim', reason: 'elsewhere', ...where })
      else done({ verdict: 'verbatim', ...where })
      matched = true
      break
    }
    if (matched) continue

    // 2. rulings and boilerplate
    const suffixBase = item.text.match(OWNER_SUFFIX)?.[1]
    if (
      item.kind === 'name' &&
      (nameDeviations.has(item.text) || (suffixBase && nameDeviations.has(suffixBase)))
    ) {
      done({ verdict: 'deviation', reason: 'printed-name' })
      continue
    }
    if (item.kind === 'prose' && (freq.get(item.text) ?? 0) >= BOILERPLATE_MIN_REPEATS) {
      done({ verdict: 'authored', reason: 'boilerplate' })
      continue
    }

    // 3. a near-miss, aligned and classified. The last candidate carries every rule applied.
    const primary = cands[cands.length - 1] ?? { text: item.text }
    const allBooks = lib.all
    const citedLayers = allBooks.filter((b) => citedBooks.has(b.spec))
    let f = fuzzy(primary.text, citedLayers.length ? citedLayers : allBooks, cited)
    if ((!f || f.score < 0.85) && citedLayers.length) {
      const g = fuzzy(
        primary.text,
        allBooks.filter((b) => !citedBooks.has(b.spec)),
        cited
      )
      if (g && (!f || g.score > f.score)) f = g
    }
    const D = tokensOf(primary.text)
    // short strings align by accident, so demand more of them; a source with
    // no local text is matched elsewhere only when it is plainly a reprint
    const need = !verifiable ? 0.85 : D.length < 6 ? 0.8 : D.length < 12 ? 0.7 : 0.6
    const where = f
      ? {
          book: f.book.spec.id,
          page: f.page,
          score: Math.round(f.score * 1000) / 1000,
          diff: shortDiff(f),
        }
      : {}
    if (f && f.score >= need && D.length >= 3 && !(item.structural && f.score < 0.85)) {
      const c = classifyFuzzy(primary.text, f, cited)
      if (primary.rule && c.verdict === 'verbatim')
        done({ verdict: 'deviation', reason: primary.rule, ...where })
      else done({ ...c, ...where })
      continue
    }

    // 4. every sentence found separately, but not the whole
    const ss = sentences(primary.text)
    if (ss.length >= 2 && ss.every((s) => search(lib, s, 'prose', item.anchors))) {
      done({ verdict: 'unverified', reason: 'split-merged', ...where })
      continue
    }

    if (!verifiable) done({ verdict: 'unverified-source', ...where })
    else if (item.structural) done({ verdict: 'authored', reason: 'structural', ...where })
    else done({ verdict: 'unverified', reason: 'no-match', ...where })
  }
  return results
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const label = (r: { verdict: string; reason?: string }) =>
  r.reason ? `${r.verdict} ${r.reason}` : r.verdict

function countBy<T>(xs: T[], key: (x: T) => string): [string, number][] {
  const m = new Map<string, number>()
  for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

function primarySource(item: ProseItem): string {
  const a = item.anchors[0]
  if (!a) return '(no source)'
  return a.booklet ? `${a.source} (${a.booklet})` : a.source
}

function printSummary(results: Result[]) {
  console.log('\nVerdicts')
  for (const v of VERDICTS) {
    const rs = results.filter((r) => r.verdict === v)
    if (rs.length === 0) continue
    console.log(`  ${v.padEnd(18)} ${String(rs.length).padStart(5)}`)
    for (const [reason, n] of countBy(rs, (r) => r.reason ?? ''))
      if (reason) console.log(`    ${reason.padEnd(20)} ${String(n).padStart(5)}`)
  }
  console.log('\nBy cited source (verbatim+deviation+authored / unverified / no local text)')
  for (const [src] of countBy(results, (r) => primarySource(r.item))) {
    const rs = results.filter((r) => primarySource(r.item) === src)
    const ok = rs.filter((r) => ['verbatim', 'deviation', 'authored'].includes(r.verdict)).length
    const unv = rs.filter((r) => r.verdict === 'unverified').length
    const nosrc = rs.filter((r) => r.verdict === 'unverified-source').length
    console.log(
      `  ${src.slice(0, 40).padEnd(41)} ${String(rs.length).padStart(5)}  ${ok}/${unv}/${nosrc}`
    )
  }
}

function excerpt(s: string, n = 90): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

/** Markdown drift summary for a PR body. Data text only — never book text. */
function markdownSummary(results: Result[], editions: Record<string, string>): string {
  const out: string[] = []
  const unv = results.filter((r) => r.verdict === 'unverified')
  out.push(`Verified ${results.length} prose strings against:`)
  for (const [k, v] of Object.entries(editions)) out.push(`- ${k}: \`${v}\``)
  out.push('', '| Verdict | Reason | Strings |', '| --- | --- | ---: |')
  for (const [l, n] of countBy(results, label)) {
    const [v, r = ''] = l.split(' ')
    out.push(`| ${v} | ${r} | ${n} |`)
  }
  out.push('', `**Drift (\`unverified\`): ${unv.length} strings.** By file:`, '')
  out.push(
    `| File | ${DRIFT_REASONS.join(' | ')} |`,
    `| --- |${DRIFT_REASONS.map(() => ' ---: |').join('')}`
  )
  for (const [file] of countBy(unv, (r) => r.item.file)) {
    const rs = unv.filter((r) => r.item.file === file)
    out.push(
      `| ${file} | ${DRIFT_REASONS.map((d) => rs.filter((r) => r.reason === d).length || '').join(' | ')} |`
    )
  }
  for (const reason of DRIFT_REASONS) {
    const rs = unv
      .filter((r) => r.reason === reason)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.item.key.localeCompare(b.item.key))
    if (rs.length === 0) continue
    out.push('', `<details><summary><code>${reason}</code>: ${rs.length}</summary>`, '')
    for (const r of rs.slice(0, 8))
      out.push(
        `- \`${r.item.file}\` **${r.item.entityName}** \`${r.item.path}\`${r.book ? ` (nearest: ${r.book} p.${r.page}${r.score !== undefined ? `, score ${r.score}` : ''})` : ''} — “${excerpt(r.item.text).replace(/\|/g, '\\|')}”`
      )
    out.push('', '</details>')
  }
  return out.join('\n')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const update = args.includes('--update')
  const summary = args.includes('--summary')
  const show = args
    .find((a) => a.startsWith('--show='))
    ?.slice('--show='.length)
    .split(',')
  const missing = (msg: string) => {
    if (update) {
      console.error(`${msg}\n--update needs the books: nothing was written.`)
      process.exitCode = 1
    } else console.log(msg)
  }

  const dir = findExtractDir()
  if (!dir)
    return missing(
      'No rules/extracted/ — run `bun run rules:extract` first (needs the PDFs in rules/).'
    )
  const files = pickFiles(dir)
  if (files.size === 0)
    return missing(`No book extracts in ${dir}/ — run \`bun run rules:extract\`.`)
  const layers: Layer[] = ['flow', 'raw']
  // A text with no PDF behind it (a transcribed blog post) has only the one
  // layer; a PDF's extract must have both, or the verdicts depend on which
  // machine ran this.
  const hasRaw = (f: string) => existsSync(join(dir, LAYER_DIR.raw, f))
  const noRaw = [...files.values()]
    .flat()
    .filter((f) => !hasRaw(f) && existsSync(join(dir, '..', f.replace(/\.txt$/, '.pdf'))))
  if (noRaw.length)
    return missing(
      `No raw text layer for ${noRaw.join(', ')} — re-run \`bun run rules:extract\` (it now writes rules/extracted/raw/).`
    )

  const books: Book[] = []
  const editions: Record<string, string> = {}
  for (const [spec, names] of files) {
    editions[spec.id] = names.map((f) => f.replace(/\.txt$/, '')).join(', ')
    for (const file of names)
      for (const layer of layers)
        if (layer === 'flow' || hasRaw(file))
          books.push(loadBook(spec, layer, join(dir, LAYER_DIR[layer], file)))
  }
  const lib = new Library(books)
  const t0 = performance.now()
  const items = collectProse()
  const results = verify(lib, items)
  console.log(
    `Rules fidelity: ${items.length} strings against ${files.size} books (${dir}), ${Math.round(performance.now() - t0)} ms`
  )
  for (const [k, v] of Object.entries(editions)) console.log(`  ${k.padEnd(26)} ${v}`)
  printSummary(results)

  if (show) {
    for (const r of results.filter((r) => show.includes(r.reason ?? r.verdict))) {
      console.log(`\n${label(r)}  ${r.item.key}  "${r.item.entityName}"`)
      console.log(
        `  cited ${r.item.anchors.map((a) => `${a.source}${a.booklet ? `/${a.booklet}` : ''}:${a.page ?? '?'}`).join(', ') || '-'}  nearest ${r.book ?? '-'}:${r.page ?? '-'}  score ${r.score ?? '-'}`
      )
      console.log(`  data: ${JSON.stringify(excerpt(r.item.text, 160))}`)
      if (r.diff) console.log(`  diff: ${r.diff}`)
    }
  }
  if (summary) console.log(`\n${markdownSummary(results, editions)}`)

  const lock: Lock = {
    editions,
    entries: new Map(
      results.map((r) => [
        r.item.key,
        {
          hash: proseHash(r.item.text),
          verdict: r.verdict,
          ...(r.reason ? { reason: r.reason } : {}),
        },
      ])
    ),
  }
  if (update) {
    writeLockFile(toLockFile(lock))
    console.log(`\nWrote ${lock.entries.size} entries to fidelity.lock.json.`)
    return
  }
  const committed = readLockFile()
  if (!committed) {
    console.log('\nNo fidelity.lock.json yet — run with --update to write it.')
    process.exitCode = 1
    return
  }
  const diff = compareWithLock(items, committed)
  const changed = results.filter((r) => {
    const e = diff.entries.get(r.item.key)
    return e && e.hash === proseHash(r.item.text) && label(e) !== label(r)
  })
  const sorted = (e: Record<string, string>) => JSON.stringify(Object.entries(e).sort())
  const editionsMoved = sorted(committed.editions ?? {}) !== sorted(editions)
  const stale = diff.unverified.length + diff.stale.length + diff.malformed.length + changed.length
  if (stale === 0 && !editionsMoved) {
    console.log('\nfidelity.lock.json is up to date.')
    return
  }
  console.log(
    `\nfidelity.lock.json is out of date: ${diff.unverified.length} unrecorded or edited, ${diff.stale.length} stale, ${diff.malformed.length} malformed, ${changed.length} verdicts changed${editionsMoved ? ', editions changed' : ''}.`
  )
  for (const r of changed.slice(0, 30)) {
    const e = diff.entries.get(r.item.key)
    console.log(`  ${r.item.key}: ${e ? label(e) : '-'} → ${label(r)}`)
  }
  console.log('Run `bun tools/check-rules-fidelity.ts --update` and commit the lock.')
  process.exitCode = 1
}

await main()
