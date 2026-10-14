/**
 * Numbers under rules fidelity: the stat half of the lock.
 *
 * `collectProse` walks strings only, so the numbers a table plays from — Tech
 * Level, slots, Salvage Value, SP/EP/Heat/Cargo, AP and EP costs, ranges,
 * damage, trait amounts and pattern contents — had no gate, and that is where
 * errata land. Here every stat block in the dataset becomes a `StatItem`: its
 * fields rendered the way the book prints them, keyed
 * `<file>#<entity id>[<path>]@stat` and hashed like a prose string, so the CI
 * gate (`check-fidelity-lock.ts`) fails on any number nobody re-checked.
 *
 * A block is an entity's own numbers (a chassis' eight stats; a System's Tech
 * Level, slots and Salvage Value; an NPC's HP), a chassis pattern's Systems and
 * Modules, or one action's stat line (`2EP Turn Action // Range: Medium //
 * Hot (2)`), so a line the book sets apart from its owner gets its own verdict.
 *
 * The book side is here too, as pure functions over a book's pages, so tests
 * pin it without the books: `extractStats` reads one block from the Core
 * Book's content-stream text layer (`rules/extracted/raw/`) and `statVerdict`
 * compares it with the data. Only the Core Book's layouts have extractors; a
 * block whose own citation is another book is `unverified-source` until its
 * layout gets one.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Anchor, LockEntry } from './proseFidelity'
import { anchorsOf, DATA_DIR, fold } from './proseFidelity'

/** The Core Book's citation in the data: the only layout with extractors. */
const CORE_SOURCE = 'Salvage Union Workshop Manual'

type StatKind = 'chassis' | 'pattern' | 'system' | 'module' | 'drone' | 'npc' | 'squad' | 'ability'

/** One printed stat: `{ label: 'TL', value: '2' }`, or `{ label: 'Line', value: <stat line> }`. */
type StatField = { label: string; value: string }

export type StatItem = {
  /** `file#entityId[.path]@stat`: never collides with a prose key. */
  key: string
  file: string
  entityId: string
  entityName: string
  /** Where the block sits in the entity: '' for its own numbers, `.patterns[2]`, `.actions[0]`. */
  path: string
  /** The owning entity's schema. */
  kind: StatKind
  /** For a pattern: its name. For an action: its name as printed (no owner suffix). */
  name?: string
  /** For a pattern: its index among the chassis' patterns cited to the same page. */
  slot?: number
  anchors: Anchor[]
  fields: StatField[]
  /** What the lock hashes: every field, in order. */
  text: string
}

type Row = Record<string, unknown>

const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '')
const rows = (v: unknown) => (Array.isArray(v) ? (v as Row[]) : [])
const strings = (v: unknown) => (Array.isArray(v) ? v.map(str) : [])

// ---------------------------------------------------------------------------
// Rendering the data the way the book prints it
// ---------------------------------------------------------------------------

const ACTION_TYPE: Record<string, string> = {
  Turn: 'Turn Action',
  Short: 'Short Action',
  Long: 'Long Action',
  Free: 'Free Action',
  DownTime: 'Downtime Action',
  Reaction: 'Reaction',
  Passive: 'Passive',
}

const titleCase = (s: string) =>
  s.replace(/(^|[\s-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase())

/**
 * An action's stat line as the book sets it: `2EP Turn Action // Range: Close
 * // Damage: 3 SP // Energy // Hot (2)`. Empty when the action has none.
 */
export function renderStatLine(a: Row, currency: string, extra: string[] = []): string {
  const parts: string[] = []
  const cost = str(a.activationCost)
  const head = [cost && `${cost}${currency}`, ACTION_TYPE[str(a.actionType)]].filter(Boolean)
  if (head.length) parts.push(head.join(' '))
  const range = strings(a.range)
  if (range.length) parts.push(`Range: ${range.join('/')}`)
  const dmg = a.damage as Row | undefined
  if (dmg) parts.push(`Damage: ${str(dmg.amount)} ${str(dmg.damageType)}`)
  for (const t of rows(a.traits)) {
    const amount = str(t.amount)
    parts.push(`${titleCase(str(t.type))}${amount ? ` (${amount})` : ''}`)
  }
  parts.push(...extra)
  return parts.join(' // ')
}

/** An action's name as the book prints it: no `(Owner)` suffix. */
function printedActionName(a: Row): string {
  if (typeof a.displayName === 'string') return a.displayName
  return str(a.name).replace(/ \([^)]+\)$/, '')
}

const fieldsText = (fields: StatField[]) => fields.map((f) => `${f.label}: ${f.value}`).join(' | ')

/** `Name x N` for a counted entry, as the book prints a pattern's duplicates. */
const counted = (name: string, count: number) => (count > 1 ? `${name} x ${count}` : name)

/** Consecutive repeats collapsed to `Name x N`. */
function collapse(names: string[]): string[] {
  const out: { name: string; n: number }[] = []
  for (const n of names) {
    const last = out[out.length - 1]
    if (last && last.name === n) last.n++
    else out.push({ name: n, n: 1 })
  }
  return out.map((x) => counted(x.name, x.n))
}

// ---------------------------------------------------------------------------
// Collecting the dataset's stat blocks
// ---------------------------------------------------------------------------

function load(dataDir: string, file: string): Row[] {
  try {
    return JSON.parse(readFileSync(join(dataDir, file), 'utf8')) as Row[]
  } catch {
    return []
  }
}

/** Every stat block in the dataset, in file order, each field in the book's order. */
export function collectStats(dataDir = DATA_DIR): StatItem[] {
  const files = new Set(readdirSync(dataDir).filter((f) => f.endsWith('.json')))
  const actions = new Map<string, Row>()
  for (const a of files.has('actions.json') ? load(dataDir, 'actions.json') : [])
    actions.set(str(a.name), a)
  const out: StatItem[] = []
  const push = (
    file: string,
    e: Row,
    kind: StatKind,
    fields: StatField[],
    extra: Partial<StatItem> = {}
  ) => {
    if (fields.length === 0 || fields.every((f) => f.value === '')) return
    const path = extra.path ?? ''
    out.push({
      key: `${file}#${str(e.id)}${path}@stat`,
      file,
      entityId: str(e.id),
      entityName: str(e.name),
      path,
      kind,
      anchors: anchorsOf(e),
      fields,
      text: fieldsText(fields),
      ...extra,
    })
  }
  /** One block per action with a stat line; `recommended` joins the owner's own action. */
  const pushActions = (
    file: string,
    e: Row,
    kind: StatKind,
    currency: string,
    recommended?: string
  ) =>
    strings(e.actions).forEach((n, i) => {
      const a = actions.get(n)
      if (!a) return
      const name = printedActionName(a)
      const extra = recommended && name === str(e.name) ? [recommended] : []
      push(file, e, kind, [{ label: 'Line', value: renderStatLine(a, currency, extra) }], {
        path: `.actions[${i}]`,
        name,
      })
    })

  for (const e of load(dataDir, 'chassis.json')) {
    push('chassis.json', e, 'chassis', [
      { label: 'SP', value: str(e.structurePoints) },
      { label: 'EP', value: str(e.energyPoints) },
      { label: 'Heat', value: str(e.heatCapacity) },
      { label: 'System Slots', value: str(e.systemSlots) },
      { label: 'Module Slots', value: str(e.moduleSlots) },
      { label: 'Cargo', value: str(e.cargoCapacity) },
      { label: 'TL', value: str(e.techLevel) },
      { label: 'SV', value: str(e.salvageValue) },
    ])
    const slots = new Map<string, number>()
    rows(e.patterns).forEach((p, i) => {
      const list = (k: string) =>
        rows(p[k])
          .map((s) => counted(str(s.name), typeof s.count === 'number' ? s.count : 1))
          .join(', ')
      const anchors = anchorsOf(p)
      const at = JSON.stringify(anchors[0] ?? {})
      const slot = slots.get(at) ?? 0
      slots.set(at, slot + 1)
      push(
        'chassis.json',
        e,
        'pattern',
        [
          { label: 'Systems', value: list('systems') },
          { label: 'Modules', value: list('modules') },
        ],
        { path: `.patterns[${i}]`, name: str(p.name), anchors, slot }
      )
    })
  }

  for (const [file, kind, rec] of [
    ['systems.json', 'system', 'Recommended System'],
    ['modules.json', 'module', 'Recommended Module'],
  ] as const)
    for (const e of load(dataDir, file)) {
      push(file, e, kind, [
        { label: 'TL', value: str(e.techLevel) },
        { label: 'Slots', value: str(e.slotsRequired) },
        { label: 'SV', value: str(e.salvageValue) },
      ])
      pushActions(file, e, kind, 'EP', e.recommended === true ? rec : undefined)
    }

  for (const e of load(dataDir, 'drones.json'))
    push('drones.json', e, 'drone', [
      { label: 'SP', value: str(e.structurePoints) },
      { label: 'TL', value: str(e.techLevel) },
      { label: 'SV', value: str(e.salvageValue) },
      {
        label: 'Systems',
        value: collapse([...strings(e.systems), ...strings(e.modules)]).join(', '),
      },
    ])

  for (const [file, kind] of [
    ['npcs.json', 'npc'],
    ['squads.json', 'squad'],
  ] as const)
    for (const e of load(dataDir, file)) {
      push(file, e, kind, [{ label: str(e.damageType) || 'HP', value: str(e.hitPoints) }])
      pushActions(file, e, kind, 'EP')
    }

  for (const e of load(dataDir, 'abilities.json')) pushActions('abilities.json', e, 'ability', 'AP')

  return out
}

// ---------------------------------------------------------------------------
// Reading the Core Book's stat blocks
// ---------------------------------------------------------------------------

/** One book's text layer by page, unfiltered: the stat digits are the point. */
export type Pages = Map<number, string>

export function parsePages(text: string): Pages {
  const parts = text.split(/<!-- page (\d+) -->/)
  const pages: Pages = new Map()
  for (let i = 1; i < parts.length; i += 2) pages.set(Number(parts[i]), parts[i + 1] ?? '')
  return pages
}

/** Lower-case letters and digits only: the raw layer drops and keeps spaces at random. */
const skel = (s: string) =>
  fold(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

/** A name's letters and digits, with the book's "Advanced" read as the data's "Adv.". */
const nameSkel = (s: string) => skel(fold(s).replace(/^advanced\b/i, 'adv'))

/**
 * Names the Core Book (2.0a) prints differently from the data, by `nameSkel`:
 * a pattern list's name for a part, or a part's own heading. Each is a claim
 * checked against the page given.
 */
const PRINTED_NAMES: Record<string, string> = {
  automatedturretsystemgreenlaser: 'automatedweaponturret', // pattern list, p.141
  aeonshielddome: 'shielddome', // pattern list, p.147
  advtargeting: 'advtargetingarray', // pattern lists, pp.155, 157
  concealedequipmentlocker: 'concealedlocker', // pattern list, p.135
  emselfdestruct: 'electromagneticselfdestruct', // heading, p.203
}

/**
 * A part's name for comparing lists: a configuration in parentheses dropped,
 * a trailing Module/System/Plugin and a plural "s" ignored ("Loudspeaker",
 * "Self-Destruct Module", "Encrypted Comms Plugin").
 */
export function partKey(name: string): string {
  const k = nameSkel(fold(name).replace(/\([^)]*\)/g, ' '))
  const printed = PRINTED_NAMES[k] ?? k
  return printed.replace(/(module|system|plugin)$/, '').replace(/s$/, '')
}

/** A list field, comparable: each name's `partKey`, counts kept. */
function listKey(v: string): string {
  return v
    .split(', ')
    .filter(Boolean)
    .map((x) => {
      const m = x.match(COUNT)
      return m ? `${partKey(m[1] ?? '')}x${m[2]}` : partKey(x)
    })
    .join('|')
}

type Line = { text: string; page: number }

function linesOf(pages: Pages, from: number, to: number): Line[] {
  const out: Line[] = []
  for (let p = from; p <= to; p++)
    for (const l of (pages.get(p) ?? '').split('\n')) {
      const text = fold(l).replace(/\s+/g, ' ').trim()
      if (text) out.push({ text, page: p })
    }
  return out
}

/** Joined lines: a word broken over a line keeps no space ("Arma-" + "ment"). */
const joinLines = (ls: Line[]) =>
  ls.reduce(
    (acc, l) =>
      acc === '' ? l.text : /\w-$/.test(acc) ? `${acc.slice(0, -1)}${l.text}` : `${acc} ${l.text}`,
    ''
  )

/**
 * What can precede a name on its own line: a cost (`2EP Patch`), a running
 * head (`TECH 2 Riveting Gun`, or its digit left over), an Ability's level
 * number (`1Mass Field Maintenance`).
 */
const NAME_PREFIX = /^(?:([0-9X]+) ?([EA]P) |TECH \d+ |\d ?)/i

type NameHit = { at: number; next: number; cost?: string }

/**
 * The first line in `[from, to)` that reads `name`, possibly after a prefix
 * or wrapped over three lines, with a trailing cross-reference (`p. 196`)
 * ignored: the index after the name, and any cost printed before it.
 */
function findName(lines: Line[], name: string, from = 0, to = lines.length): NameHit | undefined {
  const want = nameSkel(name)
  if (!want) return undefined
  const read = (s: string) => {
    const k = nameSkel(s)
    return PRINTED_NAMES[k] ?? k
  }
  for (let i = from; i < to; i++) {
    for (let k = 1; k <= 3 && i + k <= to; k++) {
      const joined = joinLines(lines.slice(i, i + k)).replace(/(\s+p\. ?\d+|:)$/, '')
      // a prefix shares the name's first line: a lone "4" above a heading is a Salvage Value
      const m = joined.match(NAME_PREFIX)
      const prefixed = m && m[0].trim().length < (lines[i]?.text.length ?? 0) ? m : null
      const rest = prefixed ? joined.slice(prefixed[0].length) : joined
      if (read(rest) === want) {
        const cost = prefixed?.[1] ? `${prefixed[1]}${prefixed[2]}` : undefined
        return { at: i, next: i + k, ...(cost ? { cost } : {}) }
      }
      if (read(joined) === want) return { at: i, next: i + k }
      if (!want.startsWith(nameSkel(rest)) && !want.startsWith(nameSkel(joined))) break
    }
  }
  return undefined
}

const STAT_START =
  /^(?:[0-9X]+ ?[EAX]P\b|range ?:|damage ?:|(?:turn|short|long|free|downtime) ?action|reaction|passive)/i

const isTrait = (ctx: StatContext, s: string) => ctx.traits.has(skel(s.replace(/\([^)]*\)$/, '')))

/**
 * The stat line at `lines[i]` and the index after it, joined over the lines it
 * wraps onto: after a line ending in `//` or `-`, a next line opening with
 * `//` or `(`, or a lone trait. Empty when `lines[i]` is no stat line.
 */
function statSpan(
  ctx: StatContext,
  lines: Line[],
  i: number,
  cost?: string
): { line: string; end: number } {
  const first = lines[i]?.text ?? ''
  if (!STAT_START.test(first) && !first.includes('//') && !isTrait(ctx, first))
    return { line: cost ?? '', end: i }
  let line = first
  let j = i + 1
  for (; j < lines.length; j++) {
    const next = lines[j]?.text ?? ''
    const lone = isTrait(ctx, next)
    if (!(/(\/\/|-)$/.test(line) || /^(\/\/|\()/.test(next) || lone)) break
    if (/\w-$/.test(line)) line = `${line.slice(0, -1)}${next}`
    else line = `${line} ${lone && !/\/\/$/.test(line) ? '// ' : ''}${next}`
  }
  return { line: cost ? `${cost} ${line}` : line, end: j }
}

/** Canonical tokens of a stat line: a cost, an action type, then each other part. */
export function statTokens(line: string): string[] {
  const t = fold(line)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9():/]/g, '')
  const out: string[] = []
  t.split('//')
    .filter(Boolean)
    .forEach((seg, i) => {
      let s = seg
      const cost = i === 0 ? s.match(/^([0-9x]+)([eax]p)/) : null
      if (cost) {
        out.push(`cost:${cost[1]}${cost[2]}`)
        s = s.slice(cost[0].length)
      }
      const type = s.match(/^(?:(turn|short|long|free|downtime)action|(reaction|passive))(.*)$/)
      if (type) {
        out.push(`type:${type[1] ?? type[2]}`)
        s = type[3] ?? ''
      }
      if (s) out.push(s)
    })
  return out
}

/**
 * Do two stat lines say the same? Order-free, and the action type counts only
 * where the book prints one: a weapon's line leaves its Turn Action implied.
 */
export function sameStatLine(data: string, book: string): boolean {
  const b = statTokens(book)
  const typed = b.some((t) => t.startsWith('type:'))
  const d = statTokens(data)
    .filter((t) => (typed || !t.startsWith('type:')) && !MODELLED.includes(t))
    // a damage the book prints without SP or HP ("Damage: 2d20") still has its amount checked
    .map((t) =>
      t.startsWith('damage:') && b.includes(t.replace(/(sp|hp)$/, ''))
        ? t.replace(/(sp|hp)$/, '')
        : t
    )
  return [...d].sort().join('|') === [...b].sort().join('|')
}

/**
 * Data tokens the book never sets in a stat line: `Uses (Destroy)` is how the
 * dataset holds "destroyed when used", which the book says in the text.
 */
const MODELLED = ['uses(destroy)']

const COUNT = /^(.*?)\s*[x×]\s*(\d+)$/

/**
 * Part names from `lines[from, to)`, by `partKey`: a name wrapped over lines
 * joined, a configuration line after it taken in, a `× N` count on its line
 * or the next kept. With `stopAtUnknown` the list ends at the first line that
 * is no part; otherwise that line is kept as printed, so it shows in a diff.
 */
function readList(
  lines: Line[],
  from: number,
  to: number,
  known: Set<string>,
  stopAtUnknown: boolean
): { names: string[]; end: number } {
  const names: string[] = []
  let i = from
  while (i < to) {
    let hit: { name: string; count: number; used: number } | undefined
    for (let k = 1; k <= 3 && i + k <= to && !hit; k++) {
      const read = (n: number) => {
        const joined = joinLines(lines.slice(i, i + n))
        const m = joined.match(COUNT)
        return { base: m?.[1] ?? joined, count: m ? Number(m[2]) : 1 }
      }
      let r = read(k)
      const key = partKey(r.base)
      if (!known.has(key)) continue
      // take in what only qualifies the name: "Plugin", "(Mule)", "(Iron Spear)"
      let used = k
      while (i + used < to && partKey(read(used + 1).base) === key) r = read(++used)
      const lone = i + used < to ? lines[i + used]?.text.match(/^[x×]\s*(\d+)$/) : null
      hit = lone
        ? { name: r.base, count: Number(lone[1]), used: used + 1 }
        : { name: r.base, count: r.count, used }
    }
    if (hit) {
      names.push(counted(hit.name, hit.count))
      i += hit.used
    } else if (stopAtUnknown) break
    else names.push(lines[i++]?.text ?? '')
  }
  return { names, end: i }
}

/** What the Core Book extractors read: its pages, every System, Module and trait name. */
export type StatContext = {
  pages: Pages
  systems: Set<string>
  modules: Set<string>
  traits: Set<string>
}

export function statContext(pages: Pages, dataDir = DATA_DIR): StatContext {
  const names = (f: string) => new Set(load(dataDir, f).map((e) => partKey(str(e.name))))
  const traits = new Set(
    load(dataDir, 'actions.json').flatMap((a) => rows(a.traits).map((t) => skel(str(t.type))))
  )
  return { pages, systems: names('systems.json'), modules: names('modules.json'), traits }
}

/** The book's fields for one block, under the data's labels, or why it was not found. */
type Extracted = { fields: StatField[] } | { missing: string }

/** A chassis: its name, then the eight numbers of its stat block, SP first. */
function chassisBlock(ctx: StatContext, item: StatItem, page: number): Extracted {
  const lines = linesOf(ctx.pages, page, page)
  const hit = findName(lines, item.entityName)
  if (!hit) return { missing: `no "${item.entityName}" heading on p.${page}` }
  const nums: string[] = []
  for (let i = hit.next; i < lines.length && nums.length < item.fields.length; i++) {
    const m = lines[i]?.text.match(/^(\d+)\b/)
    if (m?.[1]) nums.push(m[1])
  }
  if (nums.length < item.fields.length)
    return { missing: `the stat block on p.${page} has ${nums.length} numbers` }
  return { fields: item.fields.map((f, i) => ({ label: f.label, value: nums[i] ?? '' })) }
}

/** A pattern: the nth SYSTEMS and MODULES lists on its page, in the order the patterns print. */
function patternBlock(ctx: StatContext, item: StatItem, page: number): Extracted {
  const lines = linesOf(ctx.pages, page, page)
  const n = (item.slot ?? 0) + 1
  const at = lines.flatMap((l, i) => (l.text === 'SYSTEMS' ? [i] : []))[n - 1]
  if (at === undefined) return { missing: `no SYSTEMS list #${n} on p.${page}` }
  const mods = lines.findIndex((l, i) => i > at && l.text === 'MODULES')
  if (mods < 0) return { missing: `no MODULES list after SYSTEMS #${n} on p.${page}` }
  const systems = readList(lines, at + 1, mods, ctx.systems, false).names
  const modules = readList(lines, mods + 1, lines.length, ctx.modules, true).names
  return {
    fields: [
      { label: 'Systems', value: systems.join(', ') },
      { label: 'Modules', value: modules.join(', ') },
    ],
  }
}

/** `T<n>`, slots, Salvage Value at `lines[i]`; the last may run into the next heading ("2 Fabrication Arm"). */
const isTriple = (lines: Line[], i: number) =>
  i >= 0 &&
  /^T\d$/.test(lines[i]?.text ?? '') &&
  /^\d+$/.test(lines[i + 1]?.text ?? '') &&
  /^\d+\b/.test(lines[i + 2]?.text ?? '')

/** Does a part's heading start at `lines[i]`? */
function isPartHeading(ctx: StatContext, lines: Line[], i: number): boolean {
  for (let k = 1; k <= 3; k++) {
    const joined = joinLines(lines.slice(i, i + k)).replace(NAME_PREFIX, '')
    const key = partKey(joined)
    if (ctx.systems.has(key) || ctx.modules.has(key)) return true
  }
  return false
}

/**
 * A System or Module: its heading, and the index of its `T<n>` triple, the
 * first after its text. Where the raw layer sets the heading after the text
 * (the heading and stat line run straight into the next part's heading or a
 * `TECH n` running head), the triple is the one just before the heading.
 */
function partBounds(ctx: StatContext, name: string, page: number) {
  const lines = linesOf(ctx.pages, page, page + 1)
  const next = lines.findIndex((l) => l.page === page + 1)
  const hit = findName(lines, name, 0, next < 0 ? lines.length : next)
  if (!hit) return undefined
  const after = statSpan(ctx, lines, hit.next).end
  const nextHead = isPartHeading(ctx, lines, after) || /^TECH \d+$/.test(lines[after]?.text ?? '')
  if (nextHead && isTriple(lines, hit.at - 3)) return { lines, hit, end: hit.at - 3, before: true }
  for (let i = hit.next; i + 2 < lines.length; i++)
    if (isTriple(lines, i)) return { lines, hit, end: i, before: false }
  return { lines, hit, end: -1, before: false }
}

/** A System's or Module's own numbers: `T<n>`, slots, Salvage Value after its text. */
function partBlock(ctx: StatContext, item: StatItem, page: number): Extracted {
  const b = partBounds(ctx, item.entityName, page)
  if (!b) return { missing: `no "${item.entityName}" on p.${page}` }
  if (b.end < 0)
    return { missing: `no Tech Level, slots and Salvage Value after "${item.entityName}"` }
  const book: Record<string, string> = {
    TL: b.lines[b.end]?.text.slice(1) ?? '',
    Slots: b.lines[b.end + 1]?.text ?? '',
    SV: b.lines[b.end + 2]?.text.match(/^\d+/)?.[0] ?? '',
  }
  return { fields: item.fields.map((f) => ({ label: f.label, value: book[f.label] ?? '' })) }
}

/**
 * An action's stat line: after its owner's heading when it is the owner's
 * own action, else after its name inside the owner's block, else the nearest
 * before the heading (the raw layer can set a sidebar's text first).
 */
function lineIn(
  ctx: StatContext,
  item: StatItem,
  lines: Line[],
  heading: NameHit,
  end: number
): Extracted {
  const name = item.name ?? ''
  let at: NameHit | undefined =
    skel(name) === skel(item.entityName) ? heading : findName(lines, name, heading.next, end)
  for (let i = heading.at - 1; !at && i >= 0; i--) {
    const h = findName(lines, name, i, heading.at)
    if (h?.at === i) at = h
  }
  if (!at) return { missing: `no "${name}" near "${item.entityName}"` }
  const { line } = statSpan(ctx, lines, at.next, at.cost)
  if (!line) return { missing: `no stat line after "${name}"` }
  return { fields: [{ label: 'Line', value: line }] }
}

function partActionBlock(ctx: StatContext, item: StatItem, page: number): Extracted {
  const b = partBounds(ctx, item.entityName, page)
  if (!b) return { missing: `no "${item.entityName}" on p.${page}` }
  return lineIn(ctx, item, b.lines, b.hit, b.end < 0 || b.before ? b.lines.length : b.end)
}

const isSvLine = (lines: Line[], i: number) =>
  /^T\d$/.test(lines[i - 1]?.text ?? '') && /^\d+$/.test(lines[i]?.text ?? '')

/** A drone: description, systems, then its name, `SP n`, `T<n>` and Salvage Value. */
function droneBlock(ctx: StatContext, item: StatItem, page: number): Extracted {
  const lines = linesOf(ctx.pages, page, page)
  for (let i = 0; i + 3 < lines.length; i++) {
    if (skel(lines[i]?.text ?? '') !== skel(item.entityName)) continue
    const sp = lines[i + 1]?.text.match(/^SP (\d+)$/)
    const tl = lines[i + 2]?.text.match(/^T(\d)$/)
    const sv = lines[i + 3]?.text.match(/^(\d+)$/)
    if (!sp || !tl || !sv) continue
    // its systems run back to the previous drone's Salvage Value
    let start = i - 1
    while (start > 0 && !isSvLine(lines, start - 1)) start--
    const names: string[] = []
    for (let j = start; j < i; ) {
      const r = readList(lines, j, i, new Set([...ctx.systems, ...ctx.modules]), true)
      names.push(...r.names)
      j = r.end > j ? r.end : j + 1
    }
    return {
      fields: [
        { label: 'SP', value: sp[1] ?? '' },
        { label: 'TL', value: tl[1] ?? '' },
        { label: 'SV', value: sv[1] ?? '' },
        { label: 'Systems', value: names.join(', ') },
      ],
    }
  }
  return { missing: `no "${item.entityName}" stat block on p.${page}` }
}

/** An NPC or Squad: its name, actions with stat lines, then `HP n` (or `SP n`). */
function npcBounds(ctx: StatContext, item: StatItem, page: number) {
  const lines = linesOf(ctx.pages, page, page)
  const hit = findName(lines, item.entityName)
  if (!hit) return undefined
  for (let i = hit.next; i < lines.length; i++) {
    const m = lines[i]?.text.match(/^(HP|SP) (\d+)\b/)
    if (m) return { lines, hit, end: i, label: m[1] ?? '', value: m[2] ?? '' }
  }
  return { lines, hit, end: -1, label: '', value: '' }
}

function npcBlock(ctx: StatContext, item: StatItem, page: number): Extracted {
  const b = npcBounds(ctx, item, page)
  if (!b) return { missing: `no "${item.entityName}" on p.${page}` }
  if (b.end < 0) return { missing: `no HP line after "${item.entityName}"` }
  return { fields: [{ label: b.label, value: b.value }] }
}

function npcActionBlock(ctx: StatContext, item: StatItem, page: number): Extracted {
  const b = npcBounds(ctx, item, page)
  if (!b) return { missing: `no "${item.entityName}" on p.${page}` }
  return lineIn(ctx, item, b.lines, b.hit, b.end < 0 ? b.lines.length : b.end)
}

/** An Ability's action: its name, then its cost and action line. */
function abilityActionBlock(ctx: StatContext, item: StatItem, page: number): Extracted {
  const lines = linesOf(ctx.pages, page, page)
  const name = item.name ?? ''
  // the name can recur in another Ability's text; the one followed by a stat line is the heading
  for (let from = 0; ; ) {
    const at = findName(lines, name, from)
    if (!at) return { missing: `no "${name}" with a stat line on p.${page}` }
    const { line } = statSpan(ctx, lines, at.next, at.cost)
    if (line) return { fields: [{ label: 'Line', value: line }] }
    from = at.next
  }
}

type Extractor = (ctx: StatContext, item: StatItem, page: number) => Extracted
const OWN: Partial<Record<StatKind, Extractor>> = {
  chassis: chassisBlock,
  pattern: patternBlock,
  system: partBlock,
  module: partBlock,
  drone: droneBlock,
  npc: npcBlock,
  squad: npcBlock,
}
const ACTION: Partial<Record<StatKind, Extractor>> = {
  system: partActionBlock,
  module: partActionBlock,
  npc: npcActionBlock,
  squad: npcActionBlock,
  ability: abilityActionBlock,
}

/** The Core Book page a block is printed on, when its own citation is the Core Book. */
function corePage(item: StatItem): number | undefined {
  const own = item.anchors[0]
  return own?.source === CORE_SOURCE && !own.booklet ? own.page : undefined
}

/** The Core Book's reading of one block; undefined when no extractor covers it. */
function extractStats(ctx: StatContext, item: StatItem): Extracted | undefined {
  const page = corePage(item)
  const extractor = (item.path.startsWith('.actions[') ? ACTION : OWN)[item.kind]
  return page === undefined || !extractor ? undefined : extractor(ctx, item, page)
}

/** Is a book field the data's? Stat lines compare as token sets, lists part by part. */
function sameField(data: StatField, book: StatField | undefined): boolean {
  if (!book) return false
  // an NPC or Squad's label is its damage track (HP or SP), printed by the book
  if (data.label !== book.label) return false
  if (data.label === 'Line') return sameStatLine(data.value, book.value)
  if (data.label === 'Systems' || data.label === 'Modules')
    return listKey(data.value) === listKey(book.value)
  return data.value === book.value
}

export type StatResult = {
  item: StatItem
  verdict: LockEntry['verdict']
  reason?: LockEntry['reason']
  /** What differs, data then book: printed locally, never written to the lock. */
  diff?: string
}

/**
 * The verdict for one block. Its own citation is not the Core Book, or there
 * is no Core Book text at hand: `unverified-source`. Its extractor cannot find
 * it: `unverified no-match`. Any field differs: `unverified stat-mismatch`.
 */
export function statVerdict(ctx: StatContext | undefined, item: StatItem): StatResult {
  const got = ctx ? extractStats(ctx, item) : undefined
  if (!got) return { item, verdict: 'unverified-source' }
  if ('missing' in got)
    return { item, verdict: 'unverified', reason: 'no-match', diff: got.missing }
  if (item.fields.every((f, i) => sameField(f, got.fields[i]))) return { item, verdict: 'verbatim' }
  const book = (i: number) => {
    const g = got.fields[i]
    if (!g?.value) return '∅'
    return g.label === item.fields[i]?.label ? g.value : `${g.label} ${g.value}`
  }
  return {
    item,
    verdict: 'unverified',
    reason: 'stat-mismatch',
    diff: item.fields
      .flatMap((f, i) =>
        sameField(f, got.fields[i]) ? [] : [`${f.label}: data[${f.value}] book[${book(i)}]`]
      )
      .join(' | '),
  }
}
