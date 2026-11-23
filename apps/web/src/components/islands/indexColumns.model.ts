// A listing's List as data: the columns a kind's entries fill, a phone's two,
// and the order a sort puts them in. `IndexLedger` draws them; a view with no
// columns of its own (the Catalog, a chapter's index) reads them here.
import type { EntityModel, EntityRef, RefEntity, RefMetaEntity } from 'salvageunion-reference'
import {
  entityRef,
  getChassisAbilities,
  SalvageUnionReference,
  toEntityModel,
} from 'salvageunion-reference'
import { entityTraitLabels, entityTraitTerms } from '../../lib/listingTraits'
import { islandsCopy } from '../../messages/components-islands'
import type { LedgerColumn, LedgerSort } from '../entity/Ledger'

/** A name a cell prints, with the entry it names, which Peeks (r6 G2, G7). */
export type IndexTerm = { label: string; ref?: EntityRef | undefined }

type IndexColumn = LedgerColumn & {
  value: (item: RefEntity, model: EntityModel) => string
  /** The names the cell prints (`value`, joined), each its entry's Peek. */
  terms?: (item: RefEntity, model: EntityModel) => readonly IndexTerm[]
}

/** A book stat's column, by the model's key (`book-Structure Points`). */
function stat(label: string, title: string, key: string, phone: boolean): IndexColumn {
  return {
    key,
    label,
    title,
    kind: 'figure',
    phone,
    value: (_item, model) => {
      const found = model.bookStats.find((fact) => fact.key === key)
      return found ? String(found.value) : ''
    },
  }
}

/** An action fact's column (`range`, `damage`). */
function fact(label: string, title: string, key: string): IndexColumn {
  return {
    key,
    label,
    title,
    kind: 'text',
    value: (_item, model) => {
      const found = model.facts.find((entry) => entry.key === key)
      return found ? String(found.value) : ''
    },
  }
}

const ACTION: IndexColumn = {
  key: 'action',
  label: islandsCopy('action'),
  kind: 'text',
  value: (_item, model) => model.actionType ?? model.mechActionType ?? '',
}

const COST: IndexColumn = {
  key: 'cost',
  label: islandsCopy('cost'),
  kind: 'text',
  value: (_item, model) => model.cost ?? '',
}

/** A name's ` (Host)` suffix, which a row of that host need not repeat. */
const SUFFIX = / \([^)]*\)$/

/** A list of names a record carries (`actions`, `systems`, `coreTrees`), less a ` (Host)` suffix. */
function names(label: string, field: string): IndexColumn {
  return {
    key: field,
    label,
    kind: 'quiet',
    value: (item) => {
      const list = (item as unknown as Record<string, unknown>)[field]
      if (!Array.isArray(list)) return ''
      return list
        .map((entry) => (typeof entry === 'string' ? entry : String(entry?.name ?? '')))
        .map((name) => name.replace(SUFFIX, ''))
        .filter((name) => name && name !== item.name)
        .join(', ')
    },
  }
}

/** A word a record carries (`tree`). */
function word(label: string, field: string): IndexColumn {
  return {
    key: field,
    label,
    kind: 'text',
    value: (item) => String((item as unknown as Record<string, unknown>)[field] ?? ''),
  }
}

const LEAD: IndexColumn = {
  key: 'lead',
  label: islandsCopy('description'),
  kind: 'quiet',
  value: (item, model) =>
    'description' in item && typeof item.description === 'string'
      ? item.description
      : (model.lead ?? ''),
}

/**
 * The traits a row carries, each with its value ("Hot 3", r5 E8): what the
 * listing's Trait filter picks from, by name (RR-05). The quiet line of a kind
 * that carries them (ledger L5), in place of its opening words, which its Page
 * and its Catalog tile have.
 */
const TRAITS: IndexColumn = {
  key: 'traits',
  label: islandsCopy('traits'),
  kind: 'quiet',
  value: (_item, model) => entityTraitLabels(model).join(', '),
  // Each trait Peeks its meaning in place: no page load to learn a word (r6 G2).
  terms: (_item, model) => entityTraitTerms(model),
}

const CHASSIS_ABILITY = names(islandsCopy('chassisAbility'), 'chassisAbilities')

/** A chassis's abilities, each Peeking its rules where the row stands (r6 G7). */
const CHASSIS_ABILITIES: IndexColumn = {
  ...CHASSIS_ABILITY,
  // The names `value` prints, each with the action it names.
  terms: (item) =>
    (getChassisAbilities(item as RefMetaEntity) ?? [])
      .map((action) => ({ label: action.name.replace(SUFFIX, ''), ref: entityRef(action) }))
      .filter(({ label }) => label && label !== item.name),
}

/** The row's Tech Level, sorted by its stamp on the head strip: the name's rank, not a column (ledger L4). */
export const SORT_TECH_LEVEL = 'tl'

const ACTIONS = names(islandsCopy('actions'), 'actions')

const OWN_TREES = names(islandsCopy('coreTrees'), 'coreTrees')

/**
 * A class's Core trees: a Core class's own, and for a Hybrid Class the Core
 * trees it branches into, which its tree's requirement names (Core Book p.23).
 */
const CLASS_TREES: IndexColumn = {
  ...OWN_TREES,
  value: (item, model) => {
    const own = OWN_TREES.value(item, model)
    if (own || !('advancedTree' in item) || !item.advancedTree) return own
    const tree = SalvageUnionReference.AbilityTreeRequirements.getByName(item.advancedTree)
    return tree ? tree.requirement.join(', ') : ''
  },
}

/** The quiet line a kind's rows end on; every other kind's is its opening words. */
const QUIET: Readonly<Record<string, IndexColumn>> = {
  chassis: CHASSIS_ABILITIES,
  npcs: ACTIONS,
  'bio-titans': ACTIONS,
  creatures: ACTIONS,
  squads: ACTIONS,
  meld: ACTIONS,
  drones: names(islandsCopy('systems'), 'systems'),
  classes: CLASS_TREES,
}

/** The words a kind's rows carry before their stats. */
const WORDS: Readonly<Record<string, readonly IndexColumn[]>> = {
  abilities: [
    {
      key: 'level',
      label: islandsCopy('lvl'),
      title: islandsCopy('levelInItsTree'),
      kind: 'figure',
      phone: true,
      value: (_item, model) => model.tier ?? '',
    },
    word(islandsCopy('tree'), 'tree'),
  ],
  classes: [
    {
      key: 'kind',
      label: islandsCopy('advancesInto'),
      kind: 'text',
      value: (item) =>
        ['advancedTree', 'legendaryTree']
          .map((field) => (item as unknown as Record<string, unknown>)[field])
          .filter((tree) => typeof tree === 'string' && tree)
          .join(' · '),
    },
  ],
  crawlers: [
    {
      key: 'npc',
      label: islandsCopy('npc'),
      kind: 'text',
      value: (item) =>
        'npc' in item && item.npc && typeof item.npc === 'object' && 'position' in item.npc
          ? String(item.npc.position)
          : '',
    },
    names(islandsCopy('ability'), 'actions'),
  ],
  'crawler-bays': [
    {
      key: 'npc',
      label: islandsCopy('crew'),
      kind: 'text',
      value: (item) =>
        'npc' in item && item.npc && typeof item.npc === 'object' && 'position' in item.npc
          ? String(item.npc.position)
          : '',
    },
  ],
}

/**
 * A listing's columns after the name and Tech Level, in §2.6 order: its words
 * (a tree, a crew), every book stat any row carries (the measures), the
 * economy (action type, RNG, DMG) where any row has one, the quiet line, and
 * the cost last. A column no row fills is not drawn.
 */
export function indexColumns(
  schemaId: string,
  models: readonly { item: RefEntity; model: EntityModel }[]
): readonly IndexColumn[] {
  // Every book stat any row carries, in the model's order; a phone keeps the
  // two vitals (SP, EP) where the kind has them, its first two stats otherwise.
  const found = new Map<string, EntityModel['bookStats'][number]>()
  for (const { model } of models) {
    for (const entry of model.bookStats) {
      if (entry.key !== 'tech-level' && !found.has(entry.key)) found.set(entry.key, entry)
    }
  }
  const entries = [...found.values()]
  const vitals = entries.filter((entry) => entry.group === 'vitals')
  const phone = new Set((vitals.length > 0 ? vitals : entries).slice(0, 2).map((e) => e.key))
  const stats = new Map(
    entries.map((entry) => [
      entry.key,
      stat(entry.short ?? entry.label, entry.label, entry.key, phone.has(entry.key)),
    ])
  )
  const filled = (column: IndexColumn) =>
    models.filter(({ item, model }) => column.value(item, model)).length
  // Where a quarter of the rows carry a trait, the traits are the quiet line.
  const quiet = QUIET[schemaId] ?? (filled(TRAITS) * 4 >= models.length ? TRAITS : LEAD)
  const all = [
    ...(WORDS[schemaId] ?? []),
    ...stats.values(),
    ACTION,
    fact(islandsCopy('rng'), islandsCopy('range'), 'range'),
    fact(islandsCopy('dmg'), islandsCopy('damage'), 'damage'),
    ...(WORDS[schemaId]?.some((column) => column.kind === 'quiet') ? [] : [quiet]),
    COST,
  ]
  // A stat only a few rows carry (an Auto-Turret's among the equipment) is its
  // Page's, not a column of dashes: a stat column needs a quarter of the rows.
  const kept = all.filter((column) =>
    stats.has(column.key) ? filled(column) * 4 >= models.length : filled(column) > 0
  )
  // A stat that repeats another on every row (a Bio-Titan's Bio-Salvage Value
  // is its Structure Points) says nothing the first did not: its Page has it.
  const cells = (column: IndexColumn) =>
    models.map(({ item, model }) => column.value(item, model)).join('\u0000')
  const seen = new Set<string>()
  return kept
    .filter((column) => {
      if (!stats.has(column.key) || models.length < 2) return true
      const key = cells(column)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((column) =>
      // A cost few rows carry (a system's EP) is the one a narrow frame spares
      // first, before the quiet line (`data-spare`, `ledger.css`): a column of
      // dashes never pushes the traits out (r5 E8).
      column === COST && filled(column) * 4 < models.length ? { ...column, spare: true } : column
    )
}

/** The columns a phone can show: every one but the quiet line, which has no room there. */
export function pickable(columns: readonly IndexColumn[]): readonly IndexColumn[] {
  return columns.filter((column) => column.kind !== 'quiet')
}

/** From this many columns a List is dense: a narrow frame has no room for its quiet line too. */
export const DENSE_COLUMNS = 4

/** How many columns a phone's row holds beside its name and stamp (ledger L8). */
export const PHONE_COLUMNS = 2

/** A measure before a word: the order a phone's spare slot is filled in. */
function phoneRank(column: IndexColumn): number {
  if (column.kind === 'figure') return 0
  return ['range', 'damage'].includes(column.key) ? 1 : 2
}

/**
 * The columns a phone's row shows, in its slots' order: the reader's choice,
 * else the kind's own (its vitals). Where the reader picks them (`picked`) and
 * those leave a slot empty, a measure fills it, so the row opens on
 * real columns and no two slots read the same (Equipment, whose stats too few
 * rows carry).
 */
export function phoneColumnKeys(
  columns: readonly IndexColumn[],
  chosen: readonly string[],
  picked: boolean
): readonly string[] {
  const can = pickable(columns)
  const valid = chosen.filter(
    (key, at) => can.some((column) => column.key === key) && chosen.indexOf(key) === at
  )
  const own =
    valid.length > 0
      ? valid.slice(0, PHONE_COLUMNS)
      : can.filter((column) => column.phone).map((column) => column.key)
  if (!picked || can.length <= PHONE_COLUMNS || own.length >= PHONE_COLUMNS) return own
  const spare = can
    .filter((column) => !own.includes(column.key))
    .sort((a, b) => phoneRank(a) - phoneRank(b))
    .map((column) => column.key)
  return [...own, ...spare].slice(0, PHONE_COLUMNS)
}

/**
 * `columns` with a phone's `keys` marked, each sitting where its slot is: the
 * chosen columns keep the places they hold between them, in the slots' order,
 * so the first slot's column is drawn first.
 */
export function withPhoneColumns<Column extends { key: string; phone?: boolean }>(
  columns: readonly Column[],
  keys: readonly string[]
): readonly Column[] {
  const places = columns.flatMap((column, at) => (keys.includes(column.key) ? [at] : []))
  const next = columns.map((column) => ({ ...column, phone: false }))
  keys.forEach((key, slot) => {
    const column = columns.find((candidate) => candidate.key === key)
    const place = places[slot]
    if (column && place !== undefined) next[place] = { ...column, phone: true }
  })
  return next
}

/** The ranges, nearest first: a Range column sorts by reach, not by spelling. */
const RANGES = ['close', 'medium', 'long', 'far']

/** Dice as a cell writes them: `2d20 SP`, `1d6+2`. */
const DICE = /^(\d+)d(\d+)\s*([+-]\s*\d+)?/i

/**
 * A cell as a number: its own, dice by their average (`2d20` is 21), or a
 * range's place among the ranges.
 */
function cellNumber(cell: string): number {
  const text = cell.trim()
  const range = RANGES.indexOf(text.toLowerCase())
  if (range !== -1) return range
  const dice = DICE.exec(text)
  if (dice) {
    const bonus = Number((dice[3] ?? '0').replace(/\s/g, ''))
    return (Number(dice[1]) * (Number(dice[2]) + 1)) / 2 + bonus
  }
  return Number.parseFloat(text)
}

/** Numbers by value, a lettered tech level (B, N) after them. */
function compareValues(a: string, b: string): number {
  const [x, y] = [cellNumber(a), cellNumber(b)]
  if (Number.isNaN(x) && Number.isNaN(y)) return a.localeCompare(b)
  if (Number.isNaN(x) || Number.isNaN(y)) return Number.isNaN(x) ? 1 : -1
  return x - y
}

/** Where a cell with no value to order stands: an `X` (a variable amount) after every value, a blank last. */
function trailing(cell: string): number {
  const text = cell.trim()
  if (!text) return 2
  return /^x(\s|$)/i.test(text) ? 1 : 0
}

/**
 * A column's cells in order: the values up or down (`descending`), then the
 * variable ones (`X SP`), then the blanks, which trail in both directions, so
 * a row with nothing in the column never ranks above one that has.
 */
export function compareCells(a: string, b: string, descending = false): number {
  const [x, y] = [trailing(a), trailing(b)]
  if (x !== y) return x - y
  if (x !== 0) return 0
  return compareValues(a, b) * (descending ? -1 : 1)
}

type IndexModels = readonly { item: RefEntity; model: EntityModel }[]

/** The cell `sort` orders a row by: its name, its Tech Level, or the sorted column's. */
function sortValue(
  sort: LedgerSort,
  columns: readonly IndexColumn[],
  schemaId: string
): (entry: IndexModels[number]) => string {
  if (sort.key === 'name') return ({ item }) => item.name
  if (sort.key === SORT_TECH_LEVEL)
    return ({ model }) =>
      model.techLevel != null && !/tech-levels$/.test(schemaId) ? String(model.techLevel) : ''
  const column = columns.find((candidate) => candidate.key === sort.key)
  return ({ item, model }) => column?.value(item, model) ?? ''
}

/** `models` in `sort`'s order, ties by name; the book's order where nothing sorts. */
export function sortModels(
  models: IndexModels,
  columns: readonly IndexColumn[],
  schemaId: string,
  sort: LedgerSort | undefined
): IndexModels {
  if (!sort) return models
  const by = sortValue(sort, columns, schemaId)
  // A name is a word, never a value: it runs A to Z or back.
  const compare =
    sort.key === 'name'
      ? (a: string, b: string) => a.localeCompare(b) * (sort.descending ? -1 : 1)
      : (a: string, b: string) => compareCells(a, b, sort.descending)
  return [...models].sort((a, b) => compare(by(a), by(b)) || a.item.name.localeCompare(b.item.name))
}

/**
 * A listing's entities in the List's `sort`: what a view with no columns of
 * its own (the Catalog) draws, so a sorted link reads the same in every view.
 */
export function sortIndexItems(
  schemaId: string,
  items: readonly RefEntity[],
  sort: LedgerSort | undefined
): readonly RefEntity[] {
  if (!sort) return items
  const models = items.map((item) => ({ item, model: toEntityModel(item as RefMetaEntity) }))
  return sortModels(models, indexColumns(schemaId, models), schemaId, sort).map(({ item }) => item)
}

/**
 * The one stat a kind's entries carry beside their names where there is no
 * room for columns (a chapter's index): the List's first measure a phone
 * keeps ("SP 12"), else the cost ("1 AP") where a quarter of them pay one.
 * `undefined` where an entry has none.
 */
export function indexLeadStat(
  schemaId: string,
  items: readonly RefEntity[]
): (item: RefEntity) => string | undefined {
  const models = items.map((item) => ({ item, model: toEntityModel(item as RefMetaEntity) }))
  const columns = indexColumns(schemaId, models)
  const measure = columns.find((column) => column.kind === 'figure' && column.phone)
  // A cost only a few entries pay (nine of the equipment) is no stat of the kind.
  const paid = models.filter(({ item, model }) => COST.value(item, model)).length
  const lead = measure ?? (paid * 4 >= models.length ? COST : undefined)
  const byItem = new Map(models.map((entry) => [entry.item, entry.model]))
  return (item) => {
    const model = byItem.get(item)
    const value = lead && model ? lead.value(item, model) : ''
    if (value === '') return undefined
    return measure ? `${measure.label} ${value}` : value
  }
}
