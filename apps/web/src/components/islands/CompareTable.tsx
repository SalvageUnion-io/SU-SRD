// MOCK (Working Manual, B): a Reference index as a table to sort and compare,
// its stats in §2.6 order in tabular figures. Not shipped code.
import { useMemo, useState } from 'react'
import type { EntityModel, RefEntity, RefMetaEntity } from 'salvageunion-reference'
import { getEntitySlug, toEntityModel } from 'salvageunion-reference'
import { itemHref } from '../../lib/entityHref'
import { Badge } from '../atoms/Badge'
import { InlineRef } from '../atoms/InlineRef'
import { Box } from '../containers/Box'

type Column = {
  key: string
  label: string
  /** The header's full name, for a screen reader and the hover. */
  title?: string
  /** A number column: right-aligned, tabular, sorted as a number. */
  numeric?: boolean
  /** Kept on a phone (Name, TL and two stats). */
  phone?: boolean
  /** Drawn as chips (the traits). */
  chips?: boolean
  value: (item: RefEntity, model: EntityModel) => string
}

/** A book stat's column, by the model's key (`tech-level`, `book-Structure Points`). */
function stat(label: string, title: string, key: string, phone = false): Column {
  return {
    key,
    label,
    title,
    numeric: true,
    phone,
    value: (_item, model) => {
      const found = model.bookStats.find((fact) => fact.key === key)
      return found ? String(found.value) : ''
    },
  }
}

function fact(label: string, key: string): Column {
  return {
    key,
    label,
    value: (_item, model) => {
      const found = model.facts.find((entry) => entry.key === key)
      return found ? String(found.value) : ''
    },
  }
}

const TL = stat('TL', 'Tech Level', 'tech-level', true)
const SV = stat('SV', 'Salvage Value', 'book-Salvage Value')

const TRAITS: Column = {
  key: 'traits',
  label: 'Traits',
  chips: true,
  value: (_item, model) =>
    model.traits
      .map((trait) => (trait.param ? `${trait.name} ${trait.param}` : trait.name))
      .join(', '),
}

const ACTION: Column = {
  key: 'action',
  label: 'Action',
  value: (_item, model) => model.actionType ?? model.mechActionType ?? '',
}

/** A system's or module's columns: DMG, range and traits each in a fixed column. */
const LOADOUT_COLUMNS: Column[] = [
  TL,
  stat('Slots', 'Slots Required', 'book-Slots Required', true),
  { ...SV, phone: true },
  ACTION,
  fact('Range', 'range'),
  fact('Damage', 'damage'),
  TRAITS,
]

/** The schemas the mock draws as a table, and their columns after the name. */
export const COMPARE_COLUMNS: Readonly<Record<string, Column[]>> = {
  chassis: [
    TL,
    SV,
    stat('SP', 'Structure Points', 'book-Structure Points', true),
    stat('EP', 'Energy Points', 'book-Energy Points', true),
    stat('Sys', 'System Slots', 'book-System Slots'),
    stat('Mod', 'Module Slots', 'book-Module Slots'),
    stat('Heat', 'Heat Capacity', 'book-Heat Capacity'),
    stat('Cargo', 'Cargo Capacity', 'book-Cargo Capacity'),
    {
      key: 'ability',
      label: 'Chassis ability',
      value: (item) =>
        'chassisAbilities' in item && Array.isArray(item.chassisAbilities)
          ? item.chassisAbilities.join(', ')
          : '',
    },
  ],
  systems: LOADOUT_COLUMNS,
  modules: LOADOUT_COLUMNS,
}

type Sort = { key: string; descending: boolean }

/** Numbers by value, lettered tech levels (B, N) after them, then by name. */
function compareCells(a: string, b: string, numeric: boolean): number {
  if (!numeric) return a.localeCompare(b)
  const [x, y] = [Number.parseFloat(a), Number.parseFloat(b)]
  if (Number.isNaN(x) || Number.isNaN(y)) {
    if (Number.isNaN(x) && Number.isNaN(y)) return a.localeCompare(b)
    return Number.isNaN(x) ? 1 : -1
  }
  return x - y
}

export function CompareTable({
  schemaId,
  noun,
  items,
}: {
  schemaId: string
  /** The listing's plural name, for the count line ("chassis"). */
  noun: string
  items: RefEntity[]
}) {
  const columns = COMPARE_COLUMNS[schemaId] ?? []
  const [sort, setSort] = useState<Sort>({ key: 'tech-level', descending: false })
  const rows = useMemo(() => {
    const built = items.map((item) => {
      const model = toEntityModel(item as RefMetaEntity)
      return { item, cells: columns.map((column) => column.value(item, model)) }
    })
    const index = columns.findIndex((column) => column.key === sort.key)
    const numeric = columns[index]?.numeric ?? false
    return built.sort((a, b) => {
      const by =
        index < 0
          ? 0
          : compareCells(a.cells[index] ?? '', b.cells[index] ?? '', numeric) *
            (sort.descending ? -1 : 1)
      return by || a.item.name.localeCompare(b.item.name)
    })
  }, [items, columns, sort])
  const press = (key: string) =>
    setSort((now) => ({ key, descending: now.key === key ? !now.descending : false }))
  const sorted = columns.find((column) => column.key === sort.key)
  const heading = (key: string, label: string, title?: string) => (
    <button
      type="button"
      className="su-mock-table__sort"
      title={title}
      aria-label={`Sort by ${title ?? label}`}
      onClick={() => press(key)}
    >
      {label}
      <span
        aria-hidden="true"
        className="su-mock-table__arrow"
        data-on={sort.key === key || undefined}
      >
        {sort.key === key && sort.descending ? '▼' : '▲'}
      </span>
    </button>
  )
  const ariaSort = (key: string) =>
    sort.key === key ? (sort.descending ? 'descending' : 'ascending') : undefined

  return (
    <div className="su-mock-compare">
      <p className="su-mock-compare__count">
        <b>{rows.length}</b> {noun.toLowerCase()}
        <span>
          {sort.key === 'name'
            ? 'Sorted by name'
            : `Sorted by ${sorted?.title ?? sorted?.label ?? 'name'}, then name`}
        </span>
      </p>
      <Box frame="hairline" body="flush">
        <table className="su-mock-table su-mock-table--compare">
          <thead>
            <tr>
              <th scope="col" aria-sort={ariaSort('name')}>
                {heading('name', noun)}
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort(column.key)}
                  data-numeric={column.numeric || undefined}
                  data-phone={column.phone || undefined}
                >
                  {heading(column.key, column.label, column.title)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, cells }) => (
              <tr key={item.id}>
                <th scope="row" className="su-mock-table__name">
                  <InlineRef href={itemHref(schemaId, getEntitySlug(item))}>{item.name}</InlineRef>
                </th>
                {columns.map((column, index) => (
                  <td
                    key={column.key}
                    data-numeric={column.numeric || undefined}
                    data-phone={column.phone || undefined}
                  >
                    {column.chips && cells[index] ? (
                      <span className="su-mock-table__chips">
                        {(cells[index] ?? '').split(', ').map((chip) => (
                          <Badge key={chip} shape="chip" surface="quiet">
                            {chip}
                          </Badge>
                        ))}
                      </span>
                    ) : (
                      cells[index] || <span className="su-mock-table__none">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </div>
  )
}
