// MOCK (Working Manual, B): a compare listing's List as one Ledger: its
// entities a line each, their stats in §2.6 order in fixed columns. Not
// shipped code.
import { useMemo, useState } from 'react'
import type { EntityModel, RefEntity, RefMetaEntity } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import { Stat } from '../atoms/Stat'
import { useEntitySurface } from '../entity/entitySurfaceContext'
import type { LedgerColumn, LedgerSort } from '../entity/Ledger'
import { Ledger } from '../entity/Ledger'
import { paintFor } from '../entity/parts/paint'

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

/** A system's or module's columns. */
const LOADOUT_COLUMNS: readonly IndexColumn[] = [
  stat('Slots', 'Slots Required', 'book-Slots Required', true),
  { ...SV, phone: true },
  {
    key: 'action',
    label: 'Action',
    kind: 'text',
    value: (_item, model) => model.actionType ?? model.mechActionType ?? '',
  },
  fact('RNG', 'Range', 'range'),
  fact('DMG', 'Damage', 'damage'),
  {
    key: 'traits',
    label: 'Traits',
    kind: 'quiet',
    value: (_item, model) =>
      model.traits
        .map((trait) => (trait.param ? `${trait.name} ${trait.param}` : trait.name))
        .join(', '),
  },
]

/** The listings drawn as a Ledger, and their columns after the name and TL. */
export const INDEX_COLUMNS: Readonly<Record<string, readonly IndexColumn[]>> = {
  chassis: [
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
  ],
  systems: LOADOUT_COLUMNS,
  modules: LOADOUT_COLUMNS,
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
  const columns = INDEX_COLUMNS[schemaId] ?? []
  // The listing's own order (the book's) until the reader sorts.
  const [sort, setSort] = useState<LedgerSort | undefined>(undefined)
  const built = useMemo(
    () =>
      items.map((item) => {
        const model = toEntityModel(item as RefMetaEntity)
        const techLevel = model.techLevel != null ? String(model.techLevel) : ''
        return {
          id: item.id,
          name: item.name,
          entityRef: model.ref,
          techLevel,
          tone: model.tone,
          cells: columns.map((column) => column.value(item, model)),
        }
      }),
    [items, columns]
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
  const first = built[0]
  if (!first) return null
  return (
    <Ledger
      label={noun}
      paint={paintFor(first.tone, { texture: surface.texture })}
      nameLabel={noun}
      columns={columns}
      rows={rows.map((row) => ({
        id: row.id,
        name: row.name,
        entityRef: row.entityRef,
        stamp: row.techLevel ? <Stat label="TL" value={row.techLevel} size="mini" /> : undefined,
        cells: row.cells,
      }))}
      sort={sort}
      onSort={(key) =>
        setSort((now) => ({ key, descending: now?.key === key ? !now.descending : false }))
      }
    />
  )
}
