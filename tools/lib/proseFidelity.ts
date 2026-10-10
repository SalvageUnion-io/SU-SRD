/**
 * The book-free half of the rules-fidelity check: which strings in the dataset
 * are prose, how each is keyed and hashed, and the lock file that records a
 * verdict for each.
 *
 * Two scripts share it:
 *
 *   - `check-rules-fidelity.ts` (local only) compares every string with the
 *     rulebooks and, with `--update`, writes the lock.
 *   - `check-fidelity-lock.ts` (the CI gate) needs no book: it fails when a
 *     string's hash has no entry in the lock, so any prose edit forces a local
 *     re-verification.
 *
 * The lock holds no book text — only data paths, hashes of the DATA's text, and
 * verdict/reason codes from closed lists — so it can be committed while the
 * books stay out of git. `parseLockEntry` enforces that shape.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ProseRuleId } from '../../packages/salvageunion-reference/lib/proseDeviations'
import {
  PROSE_RULES,
  STRUCTURAL_FIELDS,
} from '../../packages/salvageunion-reference/lib/proseDeviations'

const REPO = join(import.meta.dir, '../..')
export const DATA_DIR = join(REPO, 'packages/salvageunion-reference/data')
export const LOCK_PATH = join(REPO, 'packages/salvageunion-reference/fidelity.lock.json')

// ---------------------------------------------------------------------------
// Prose collection
// ---------------------------------------------------------------------------

/** Where a string's text comes from: a book, and for a boxed set, a booklet. */
export type Anchor = { source: string; booklet?: string; page?: number }

export type ProseItem = {
  /** `file#entityId.path`: stable across row reordering and insertion. */
  key: string
  file: string
  entityId: string
  entityName: string
  /** Path inside the entity: `.content[0].value`. */
  path: string
  /** The field the string sits in (`value`, `name`, `description`, …). */
  field: string
  kind: 'name' | 'prose'
  text: string
  anchors: Anchor[]
  /** Sits under a field the dataset assembles itself (`STRUCTURAL_FIELDS`). */
  structural: boolean
  /** For `[(CHASSIS)]` text: the names of the chassis that own the action. */
  owners: string[]
}

/** Keys whose string values are not prose: enums, references, ids, urls. */
const SKIP_KEYS = new Set([
  'id',
  'type',
  'source',
  'booklet',
  'actionSource',
  'actionType',
  'damageType',
  'choiceId',
  'tree',
  'level',
  'techLevel',
  'kind',
  'schema',
  'op',
  'stat',
  'target',
  'lifetime',
  'field',
  'guideType',
  'guideTone',
  'purchaseLink',
  'range',
  'chassis',
  'pattern',
  'scalesWith',
  'scalesWithField',
  'fromStat',
  'duration',
  'unit',
  'amount',
  'entityLayout',
  'section',
  'rollTable',
  'tableName',
  'mechActionType',
  'activationCurrency',
  'activationCost',
  'actions',
  'chassisAbilities',
  'systems',
  'modules',
  'requirement',
  'coreTrees',
  'schemas',
  'entities',
  'schemaEntities',
  'advancedTree',
  'legendaryTree',
  'preselectedChoices',
  'ref',
  'drone',
  'grants',
  'formation',
  'filters',
  'appliedEffects',
  'effects',
  'contributions',
  'cardinality',
  'constraints',
  'additionalSources',
  'page',
  'hasArtwork',
])
const NAME_KEYS = new Set(['name', 'displayName', 'label', 'position'])
const STRUCTURAL = new Set<string>(STRUCTURAL_FIELDS)

type Row = Record<string, unknown>

function anchorsOf(e: Row): Anchor[] {
  const out: Anchor[] = []
  const push = (a: Row) => {
    if (typeof a.source !== 'string') return
    out.push({
      source: a.source,
      ...(typeof a.booklet === 'string' ? { booklet: a.booklet } : {}),
      ...(typeof a.page === 'number' ? { page: a.page } : {}),
    })
  }
  push(e)
  if (Array.isArray(e.additionalSources)) for (const a of e.additionalSources) push(a as Row)
  return out
}

function dedupe(anchors: Anchor[]): Anchor[] {
  const seen = new Set<string>()
  return anchors.filter((a) => {
    const k = `${a.source}|${a.booklet ?? ''}|${a.page ?? ''}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * Every string in the dataset that is prose or a printed name, in file order.
 *
 * Actions carry no source of their own: they are printed under whatever
 * references them, so an action inherits the anchors of every entity that
 * lists it in `actions` or `chassisAbilities`.
 */
export function collectProse(dataDir = DATA_DIR): ProseItem[] {
  const files = readdirSync(dataDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
  const data = new Map<string, Row[]>()
  for (const f of files) data.set(f, JSON.parse(readFileSync(join(dataDir, f), 'utf8')) as Row[])

  const owners = new Map<string, { anchors: Anchor[]; chassis: Set<string> }>()
  const collectRefs = (v: unknown, anchors: Anchor[], chassisName: string | undefined) => {
    if (Array.isArray(v)) for (const x of v) collectRefs(x, anchors, chassisName)
    else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if ((k === 'actions' || k === 'chassisAbilities') && Array.isArray(x)) {
          for (const n of x) {
            if (typeof n !== 'string') continue
            const o = owners.get(n) ?? { anchors: [], chassis: new Set<string>() }
            o.anchors.push(...anchors)
            if (chassisName) o.chassis.add(chassisName)
            owners.set(n, o)
          }
        } else collectRefs(x, anchors, chassisName)
      }
    }
  }
  for (const [f, rows] of data) {
    if (f === 'actions.json') continue
    for (const e of rows)
      collectRefs(e, anchorsOf(e), f === 'chassis.json' ? String(e.name ?? '') : undefined)
  }

  const items: ProseItem[] = []
  type Base = Pick<ProseItem, 'file' | 'entityId' | 'entityName' | 'anchors' | 'owners'>
  const walk = (v: unknown, path: string, field: string, base: Base, structural: boolean) => {
    if (typeof v === 'string') {
      if (!v.trim()) return
      items.push({
        ...base,
        key: `${base.file}#${base.entityId}${path}`,
        path,
        field,
        kind: NAME_KEYS.has(field) ? 'name' : 'prose',
        text: v,
        structural,
      })
      return
    }
    if (Array.isArray(v)) {
      v.forEach((x, i) => {
        walk(x, `${path}[${i}]`, field, base, structural)
      })
      return
    }
    if (!v || typeof v !== 'object') return
    const o = v as Row
    // A nested record with its own citation (a chassis pattern) overrides the owner's.
    const here = typeof o.source === 'string' ? { ...base, anchors: anchorsOf(o) } : base
    // `datavalues` are stat lines we built ({ label: "Damage", value: "3 SP" }).
    if (o.type === 'datavalues') return
    for (const [k, x] of Object.entries(o)) {
      if (SKIP_KEYS.has(k)) continue
      // Roll-table rows are keyed by their die range ("1", "2-5"); the field is the table's.
      const isTableKey = /^\d+(-\d+)?$/.test(k)
      walk(x, `${path}.${k}`, isTableKey ? field : k, here, structural || STRUCTURAL.has(k))
    }
  }

  for (const [f, rows] of data) {
    for (const [i, e] of rows.entries()) {
      const own = f === 'actions.json' ? owners.get(String(e.name)) : undefined
      const base: Base = {
        file: f,
        entityId: String(e.id ?? i),
        entityName: String(e.name ?? ''),
        anchors: f === 'actions.json' ? dedupe(own?.anchors ?? []) : anchorsOf(e),
        owners: [...(own?.chassis ?? [])].sort(),
      }
      for (const [k, x] of Object.entries(e)) {
        if (SKIP_KEYS.has(k)) continue
        walk(x, `.${k}`, k, base, STRUCTURAL.has(k))
      }
    }
  }
  return items
}

// ---------------------------------------------------------------------------
// Normalisation and hashing
// ---------------------------------------------------------------------------

/**
 * Typographic folding: curly quotes, dashes, ligatures, subscript digits.
 *
 * The verdict for a string cannot change under this fold — the comparison with
 * the book applies it to both sides — so the hash is taken after it. A change
 * the fold erases (a straight quote made curly) needs no re-verification; any
 * other edit changes the hash.
 */
export function fold(s: string): string {
  return s
    .normalize('NFC')
    .replace(/­/g, '') // soft hyphen
    .replace(/[   ]/g, ' ')
    .replace(/[’‘‛′`]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−‒]/g, '-')
    .replace(/…/g, '...')
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/ﬀ/g, 'ff')
    .replace(/ﬃ/g, 'ffi')
    .replace(/ﬄ/g, 'ffl')
    .replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080))
    .replace(/×/g, 'x')
    .replace(/•/g, ' ')
}

/** The lock's hash of a data string: 16 hex digits of SHA-256 over the folded text. */
export function proseHash(text: string): string {
  const normalized = fold(text).replace(/\s+/g, ' ').trim()
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

// ---------------------------------------------------------------------------
// The lock
// ---------------------------------------------------------------------------

export const VERDICTS = [
  'verbatim',
  'deviation',
  'authored',
  'unverified',
  'unverified-source',
] as const
export type Verdict = (typeof VERDICTS)[number]

/**
 * The closed list of reason codes. Rule ids come from the allowlist; the rest
 * qualify a `verbatim` match or name an `unverified` near-miss's drift class.
 */
export const VERBATIM_REASONS = [
  'elsewhere', // found in the cited book, away from the cited page
  'other-book', // found word-for-word in a book the record does not cite
  'artefact', // the only differences are PDF text-layer noise
] as const
export const DRIFT_REASONS = [
  'typo',
  'spelling',
  'paraphrase',
  'omission',
  'added-text',
  'split-merged',
  'no-match',
] as const
export type Reason =
  | ProseRuleId
  | (typeof VERBATIM_REASONS)[number]
  | (typeof DRIFT_REASONS)[number]
export const REASONS: readonly Reason[] = [
  ...VERBATIM_REASONS,
  ...DRIFT_REASONS,
  ...(Object.keys(PROSE_RULES) as ProseRuleId[]),
]

export type LockEntry = { hash: string; verdict: Verdict; reason?: Reason }

export type Lock = {
  /** Book file each source was verified against, e.g. `Salvage Union Digital Edition 2.0a`. */
  editions: Record<string, string>
  entries: Map<string, LockEntry>
}

/**
 * An entry is ONE string, `"<hash> <verdict>[ <reason>]"`: a single line per
 * prose string keeps the lock's diff readable, and a format this narrow cannot
 * carry book text.
 */
const ENTRY_RE = /^([0-9a-f]{16}) ([a-z-]+)(?: ([a-z-]+))?$/

export function parseLockEntry(raw: unknown): LockEntry | string {
  if (typeof raw !== 'string') return 'not a string'
  const m = raw.match(ENTRY_RE)
  if (!m) return `malformed: expected "<16 hex> <verdict>[ <reason>]"`
  const [, hash = '', verdict = '', reason] = m
  if (!(VERDICTS as readonly string[]).includes(verdict)) return `unknown verdict "${verdict}"`
  if (reason !== undefined && !(REASONS as readonly string[]).includes(reason))
    return `unknown reason "${reason}"`
  return { hash, verdict: verdict as Verdict, ...(reason ? { reason: reason as Reason } : {}) }
}

export function formatLockEntry(e: LockEntry): string {
  return `${e.hash} ${e.verdict}${e.reason ? ` ${e.reason}` : ''}`
}

export type LockFile = { editions: Record<string, string>; entries: Record<string, unknown> }

export function readLockFile(path = LOCK_PATH): LockFile | undefined {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as LockFile
  } catch {
    return undefined
  }
}

const LOCK_COMMENT =
  'Generated by `bun tools/check-rules-fidelity.ts --update` — never hand-edit. One entry per prose string: "<hash of the data text> <verdict>[ <reason>]". Verdicts and reasons: packages/salvageunion-reference/lib/proseDeviations.ts and tools/lib/proseFidelity.ts. Holds no book text.'

const byKey = <T>([a]: [string, T], [b]: [string, T]) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * Serialise the lock with sorted keys. Every entry is a string, so two-space
 * `JSON.stringify` is already Biome's format: one entry per line.
 */
export function serializeLock(file: LockFile): string {
  const out = {
    $comment: LOCK_COMMENT,
    editions: Object.fromEntries(Object.entries(file.editions).sort(byKey)),
    entries: Object.fromEntries(Object.entries(file.entries).sort(byKey)),
  }
  return `${JSON.stringify(out, null, 2)}\n`
}

export function toLockFile(lock: Lock): LockFile {
  return {
    editions: lock.editions,
    entries: Object.fromEntries([...lock.entries].map(([k, e]) => [k, formatLockEntry(e)])),
  }
}

export function writeLockFile(file: LockFile, path = LOCK_PATH): void {
  writeFileSync(path, serializeLock(file))
}

export type LockDiff = {
  /** Current strings with no entry, or an entry for different text. */
  unverified: { item: ProseItem; was?: LockEntry }[]
  /** Entries for strings that no longer exist. */
  stale: string[]
  /** Entries that do not parse. */
  malformed: { key: string; problem: string }[]
  /** Parsed entries, for reporting. */
  entries: Map<string, LockEntry>
}

/** Hold the data to the lock. Pure: the gate and its tests both call this. */
export function compareWithLock(items: ProseItem[], file: LockFile): LockDiff {
  const entries = new Map<string, LockEntry>()
  const malformed: LockDiff['malformed'] = []
  for (const [key, raw] of Object.entries(file.entries ?? {})) {
    const e = parseLockEntry(raw)
    if (typeof e === 'string') malformed.push({ key, problem: e })
    else entries.set(key, e)
  }
  const unverified: LockDiff['unverified'] = []
  const live = new Set<string>()
  for (const item of items) {
    live.add(item.key)
    const e = entries.get(item.key)
    if (!e || e.hash !== proseHash(item.text)) unverified.push({ item, ...(e ? { was: e } : {}) })
  }
  const stale = [...entries.keys()].filter((k) => !live.has(k))
  return { unverified, stale, malformed, entries }
}

/** Drop entries for strings that no longer exist. Needs no book: nothing is verified. */
export function pruneLock(file: LockFile, items: ProseItem[]): LockFile {
  const live = new Set(items.map((i) => i.key))
  return {
    ...file,
    entries: Object.fromEntries(Object.entries(file.entries).filter(([k]) => live.has(k))),
  }
}
