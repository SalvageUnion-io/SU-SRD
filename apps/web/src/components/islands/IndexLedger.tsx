// MOCK (Working Manual, B; wave 2: every listing): a listing's List as one
// Ledger: its entities a line each, their stats in §2.6 order in fixed
// columns (`indexColumns`). Not shipped code.
import { useMemo, useState } from 'react'
import type { EntityModel, RefEntity, RefMetaEntity } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import { CiteLine } from '../atoms/CiteLine'
import { Stat } from '../atoms/Stat'
import { paintFor } from '../entity'
import { useEntitySurface } from '../entity/entitySurfaceContext'
import type { LedgerColumn, LedgerSort } from '../entity/Ledger'
import { Ledger } from '../entity/Ledger'

type IndexColumn = LedgerColumn & { value: (item: RefEntity, model: EntityModel) => string }

/** A book stat's column, by the model's key (`book-Structure Points`). */
function stat(label: string, title: string, key: string, phone = false): IndexColumn {
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

const SV = stat('SV', 'Salvage Value', 'book-Salvage Value')

/** A chassis's columns: its stat line, then its ability. */
const CHASSIS_COLUMNS: readonly IndexColumn[] = [
  SV,
  stat('SP', 'Structure Points', 'book-Structure Points', true),
  stat('EP', 'Energy Points', 'book-Energy Points', true),
  stat('Sys', 'System Slots', 'book-System Slots'),
  stat('Mods', 'Module Slots', 'book-Module Slots'),
  stat('Heat', 'Heat Capacity', 'book-Heat Capacity'),
  stat('Cargo', 'Cargo Capacity', 'book-Cargo Capacity'),
  {
    key: 'ability',
    label: 'Chassis ability',
    kind: 'quiet',
    value: (item) =>
      'chassisAbilities' in item && Array.isArray(item.chassisAbilities)
        ? item.chassisAbilities.join(', ')
        : '',
  },
]

const ACTION: IndexColumn = {
  key: 'action',
  label: 'Action',
  kind: 'text',
  value: (_item, model) => model.actionType ?? model.mechActionType ?? '',
}

const COST: IndexColumn = {
  key: 'cost',
  label: 'Cost',
  kind: 'text',
  value: (_item, model) => model.cost ?? '',
}

const TRAITS: IndexColumn = {
  key: 'traits',
  label: 'Traits',
  kind: 'quiet',
  value: (_item, model) =>
    model.traits
      .map((trait) => (trait.param ? `${trait.name} ${trait.param}` : trait.name))
      .join(', '),
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
  label: 'Description',
  kind: 'quiet',
  value: (item, model) =>
    'description' in item && typeof item.description === 'string'
      ? item.description
      : (model.lead ?? ''),
}

/** The quiet line a kind's rows end on; every other kind's is its opening words. */
const QUIET: Readonly<Record<string, IndexColumn>> = {
  systems: TRAITS,
  modules: TRAITS,
  equipment: TRAITS,
  vehicles: TRAITS,
  npcs: names('Actions', 'actions'),
  'bio-titans': names('Actions', 'actions'),
  creatures: names('Actions', 'actions'),
  squads: names('Actions', 'actions'),
  meld: names('Actions', 'actions'),
  drones: names('Systems', 'systems'),
  classes: names('Core trees', 'coreTrees'),
}

/** The words a kind's rows carry before their stats. */
const WORDS: Readonly<Record<string, readonly IndexColumn[]>> = {
  abilities: [
    {
      key: 'level',
      label: 'Lvl',
      title: 'Level in its tree',
      kind: 'figure',
      phone: true,
      value: (_item, model) => model.tier ?? '',
    },
    word('Tree', 'tree'),
  ],
  classes: [
    {
      key: 'kind',
      label: 'Advances into',
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
      label: 'NPC',
      kind: 'text',
      value: (item) =>
        'npc' in item && item.npc && typeof item.npc === 'object' && 'position' in item.npc
          ? String(item.npc.position)
          : '',
    },
    names('Ability', 'actions'),
  ],
  'crawler-bays': [
    {
      key: 'npc',
      label: 'Crew',
      kind: 'text',
      value: (item) =>
        'npc' in item && item.npc && typeof item.npc === 'object' && 'position' in item.npc
          ? String(item.npc.position)
          : '',
    },
  ],
}

/** A short label for a book stat, as the stat column's own short form. */
function short(label: string, shortLabel: string | undefined): string {
  return shortLabel ?? label
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
  if (schemaId === 'chassis') return CHASSIS_COLUMNS
  const stats = new Map<string, IndexColumn>()
  for (const { model } of models) {
    for (const entry of model.bookStats) {
      if (entry.key === 'tech-level' || stats.has(entry.key)) continue
      stats.set(
        entry.key,
        stat(short(entry.label, entry.short), entry.label, entry.key, stats.size < 2)
      )
    }
  }
  const quiet = QUIET[schemaId] ?? LEAD
  const all = [
    ...(WORDS[schemaId] ?? []),
    ...stats.values(),
    ACTION,
    fact('RNG', 'Range', 'range'),
    fact('DMG', 'Damage', 'damage'),
    ...(WORDS[schemaId]?.some((column) => column.kind === 'quiet') ? [] : [quiet]),
    COST,
  ]
  // A stat only a few rows carry (an Auto-Turret's among the equipment) is its
  // Page's, not a column of dashes: a stat column needs a quarter of the rows.
  const filled = (column: IndexColumn) =>
    models.filter(({ item, model }) => column.value(item, model)).length
  return all.filter((column) =>
    stats.has(column.key) ? filled(column) * 4 >= models.length : filled(column) > 0
  )
}

/** Numbers by value, a lettered tech level (B, N) after them. */
function compareCells(a: string, b: string): number {
  const [x, y] = [Number.parseFloat(a), Number.parseFloat(b)]
  if (Number.isNaN(x) && Number.isNaN(y)) return a.localeCompare(b)
  if (Number.isNaN(x) || Number.isNaN(y)) return Number.isNaN(x) ? 1 : -1
  return x - y
}

export function IndexLedger({
  schemaId,
  noun,
  items,
}: {
  schemaId: string
  /** The listing's plural name: the name column's label. */
  noun: string
  items: readonly RefEntity[]
}) {
  const surface = useEntitySurface()
  // The listing's own order (the book's) until the reader sorts.
  const [sort, setSort] = useState<LedgerSort | undefined>(undefined)
  const models = useMemo(
    () => items.map((item) => ({ item, model: toEntityModel(item as RefMetaEntity) })),
    [items]
  )
  const columns = useMemo(() => indexColumns(schemaId, models), [schemaId, models])
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
      sort.key === 'name' ? row.name : (row.cells[index] ?? '')
    return [...built].sort(
      (a, b) =>
        compareCells(by(a), by(b)) * (sort.descending ? -1 : 1) || a.name.localeCompare(b.name)
    )
  }, [built, columns, sort])
  // The books the list is printed in, once, on the foot's cut-out; a list
  // whose data names none has no foot.
  const books = useMemo(
    () => [
      ...new Set(
        items
          .map((item) =>
            'source' in item && item.source
              ? String(item.source).replace(/^Salvage Union /, '')
              : ''
          )
          .filter(Boolean)
      ),
    ],
    [items]
  )
  const first = built[0]
  if (!first) return null
  return (
    <Ledger
      label={noun}
      paint={paintFor(first.tone, { texture: surface.texture })}
      nameLabel={noun}
      count={rows.length}
      columns={columns}
      rows={rows.map((row) => ({
        id: row.id,
        name: row.name,
        entityRef: row.entityRef,
        stamp: row.techLevel ? <Stat label="TL" value={row.techLevel} size="mini" /> : undefined,
        cells: row.cells,
      }))}
      foot={books.length > 0 ? <CiteLine text={books.join(' // ')} /> : undefined}
      sort={sort}
      onSort={(key) =>
        setSort((now) => ({ key, descending: now?.key === key ? !now.descending : false }))
      }
    />
  )
}
