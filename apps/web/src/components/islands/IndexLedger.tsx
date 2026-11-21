// A listing's List: one Ledger, its entities a line each, their stats in
// §2.6 order in fixed columns.
import { useMemo, useState } from 'react'
import type { EntityModel, RefEntity, RefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { entityTraitNames } from '../../lib/listingTraits'
import { islandsCopy } from '../../messages/components-islands'
import { Stat } from '../atoms/Stat'
import { paintFor } from '../entity'
import { useEntitySurface } from '../entity/entitySurfaceContext'
import type { LedgerColumn, LedgerSort } from '../entity/Ledger'
import { Ledger } from '../entity/Ledger'
import { Button, Select } from '../index'

type IndexColumn = LedgerColumn & { value: (item: RefEntity, model: EntityModel) => string }

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
        .map((name) => name.replace(/ \([^)]*\)$/, ''))
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
 * The traits a row carries, by name: what the listing's Trait filter picks
 * from (RR-05). The quiet line of a kind that carries them (ledger L5), in
 * place of its opening words, which its Page and its Catalog tile have.
 */
const TRAITS: IndexColumn = {
  key: 'traits',
  label: islandsCopy('traits'),
  kind: 'quiet',
  value: (_item, model) => entityTraitNames(model).join(', '),
}

/** The row's Tech Level, sorted by its stamp on the head strip: the name's rank, not a column (ledger L4). */
const SORT_TECH_LEVEL = 'tl'

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
  chassis: names(islandsCopy('chassisAbility'), 'chassisAbilities'),
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
function indexColumns(
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
  return kept.filter((column) => {
    if (!stats.has(column.key) || models.length < 2) return true
    const key = cells(column)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** The columns a phone can show: every one but the quiet line, which has no room there. */
function pickable(columns: readonly IndexColumn[]): readonly IndexColumn[] {
  return columns.filter((column) => column.kind !== 'quiet')
}

/** From this many columns a List is dense: a narrow frame has no room for its quiet line too. */
const DENSE_COLUMNS = 4

/** How many columns a phone's row holds beside its name and stamp (ledger L8). */
const PHONE_COLUMNS = 2

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

/** A cell as a number: its own, or a range's place among the ranges. */
function cellNumber(cell: string): number {
  const range = RANGES.indexOf(cell.trim().toLowerCase())
  return range === -1 ? Number.parseFloat(cell) : range
}

/** Numbers by value, a lettered tech level (B, N) after them. */
function compareCells(a: string, b: string): number {
  const [x, y] = [cellNumber(a), cellNumber(b)]
  if (Number.isNaN(x) && Number.isNaN(y)) return a.localeCompare(b)
  if (Number.isNaN(x) || Number.isNaN(y)) return Number.isNaN(x) ? 1 : -1
  return x - y
}

type IndexLedgerProps = {
  schemaId: string
  /** The listing's plural name: the name column's label. */
  noun: string
  /** The list is named by the page's own header: its cut-out reads `Name`. */
  plain?: boolean
  items: readonly RefEntity[]
  /**
   * The listing's sort, where it keeps one (in the URL, `useListingFilters`):
   * `sort`, what a pressed column asks, and the way back to the book's order.
   * Without it the Ledger keeps its own.
   */
  order?: {
    sort: LedgerSort | undefined
    sortBy: (key: string) => void
    clear: () => void
  }
  /**
   * The columns a phone's row shows, where the reader chose them, and the
   * choice. With it the List offers its Columns control on a phone (RR-06).
   */
  phone?: { columns: readonly string[]; setColumns: (keys: readonly string[]) => void }
  /** Say the order above the list, with the way back to the book's (the first of a listing's lists). */
  orderNote?: boolean
}

export function IndexLedger({
  schemaId,
  noun,
  plain = false,
  items,
  order,
  phone,
  orderNote = false,
}: IndexLedgerProps) {
  const surface = useEntitySurface()
  // The listing's own order (the book's) until the reader sorts.
  const [ownSort, setOwnSort] = useState<LedgerSort | undefined>(undefined)
  const sort = order ? order.sort : ownSort
  const sortBy =
    order?.sortBy ??
    ((key: string) =>
      setOwnSort((now) => ({ key, descending: now?.key === key ? !now.descending : false })))
  const models = useMemo(
    () => items.map((item) => ({ item, model: toEntityModel(item as RefMetaEntity) })),
    [items]
  )
  const found = useMemo(() => indexColumns(schemaId, models), [schemaId, models])
  // A phone's two columns: the reader's, else the kind's own (its vitals).
  const columns = useMemo(
    () => withPhoneColumns(found, phoneColumnKeys(found, phone?.columns ?? [], Boolean(phone))),
    [found, phone]
  )
  const built = useMemo(
    () =>
      models.map(({ item, model }) => {
        // A tech-level listing's rows are named by their level: no stamp.
        const techLevel =
          model.techLevel != null && !/tech-levels$/.test(schemaId) ? String(model.techLevel) : ''
        return {
          id: item.id,
          name: item.name,
          entityRef: model.ref,
          techLevel,
          tone: model.tone,
          cells: columns.map((column) => column.value(item, model)),
        }
      }),
    [models, columns, schemaId]
  )
  const rows = useMemo(() => {
    if (!sort) return built
    const index = columns.findIndex((column) => column.key === sort.key)
    const by = (row: (typeof built)[number]) =>
      sort.key === 'name'
        ? row.name
        : sort.key === SORT_TECH_LEVEL
          ? row.techLevel
          : (row.cells[index] ?? '')
    return [...built].sort(
      (a, b) =>
        compareCells(by(a), by(b)) * (sort.descending ? -1 : 1) || a.name.localeCompare(b.name)
    )
  }, [built, columns, sort])
  // MOCK (best, revision 8): no count on the tab and no books on a foot cut-out.
  const first = built[0]
  if (!first) return null
  const hasTechLevels = built.some((row) => row.techLevel)
  const sortColumn = columns.find((column) => column.key === sort?.key)
  const sorted =
    sort &&
    (sort.key === 'name'
      ? islandsCopy('name')
      : sort.key === SORT_TECH_LEVEL
        ? islandsCopy('techLevel')
        : (sortColumn?.title ?? sortColumn?.label))
  // Words sort by spelling, measures by size.
  const measured =
    sort?.key === SORT_TECH_LEVEL ||
    sortColumn?.kind === 'figure' ||
    ['range', 'damage'].includes(sort?.key ?? '')
  const sortedLine = (column: string) =>
    sort?.descending
      ? measured
        ? islandsCopy('sortedDown', { column })
        : islandsCopy('sortedZa', { column })
      : measured
        ? islandsCopy('sortedUp', { column })
        : islandsCopy('sortedAz', { column })
  const shown = pickable(columns)
  const onPhone = shown.filter((column) => column.phone).map((column) => column.key)
  /** Slot `slot` of the phone's row shows `key`; the other slot keeps its own, or swaps. */
  const pickColumn = (slot: number, key: string) => {
    const next = [...onPhone]
    const other = next.indexOf(key)
    if (other !== -1 && other !== slot) next[other] = next[slot] ?? ''
    next[slot] = key
    phone?.setColumns(next.filter(Boolean).slice(0, PHONE_COLUMNS))
  }
  return (
    <>
      {orderNote && (
        <p className="su-listing__order" aria-live="polite">
          {sorted ? sortedLine(sorted) : islandsCopy('bookOrder')}
          {sort && order && (
            <Button variant="ghost" size="compact" onClick={order.clear}>
              {islandsCopy('backToBookOrder')}
            </Button>
          )}
        </p>
      )}
      {phone && shown.length > PHONE_COLUMNS && (
        <fieldset className="su-listing__columns">
          <legend>{islandsCopy('columns')}</legend>
          {Array.from({ length: PHONE_COLUMNS }, (_, slot) => (
            <Select
              // biome-ignore lint/suspicious/noArrayIndexKey: the row's two fixed slots
              key={slot}
              chevron
              aria-label={islandsCopy('columnSlot', { slot: slot + 1 })}
              value={onPhone[slot] ?? ''}
              onChange={(e) => pickColumn(slot, e.target.value)}
            >
              {shown.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.title ?? column.label}
                </option>
              ))}
            </Select>
          ))}
        </fieldset>
      )}
      {/* The list is a section of its own: the note and the phone's column
          picks over it are the listing's tools, never controls beside it (C8). */}
      <section>
        <Ledger
          label={noun}
          paint={paintFor(first.tone, { texture: surface.texture })}
          nameLabel={plain ? islandsCopy('name') : noun}
          columns={columns}
          rows={rows.map((row) => ({
            id: row.id,
            name: row.name,
            entityRef: row.entityRef,
            stamp: row.techLevel ? (
              <Stat label={islandsCopy('tl')} value={row.techLevel} size="mini" />
            ) : undefined,
            cells: row.cells,
          }))}
          sort={sort}
          onSort={sortBy}
          {...(hasTechLevels
            ? {
                rank: {
                  key: SORT_TECH_LEVEL,
                  label: islandsCopy('tl'),
                  title: islandsCopy('techLevel'),
                },
              }
            : {})}
          dense={shown.length >= DENSE_COLUMNS}
        />
      </section>
    </>
  )
}
