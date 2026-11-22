// A listing's List: one Ledger, its entities a line each, their stats in
// §2.6 order in fixed columns.
import { useMemo, useState } from 'react'
import type { RefEntity, RefMetaEntity } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import { islandsCopy } from '../../messages/components-islands'
import { Stat } from '../atoms/Stat'
import { paintFor } from '../entity'
import { useEntitySurface } from '../entity/entitySurfaceContext'
import type { LedgerSort } from '../entity/Ledger'
import { Ledger } from '../entity/Ledger'
import { Button, Select } from '../index'
import {
  DENSE_COLUMNS,
  indexColumns,
  PHONE_COLUMNS,
  phoneColumnKeys,
  pickable,
  SORT_TECH_LEVEL,
  sortModels,
  withPhoneColumns,
} from './indexColumns.model'

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
    sortBy: (key: string, highFirst?: boolean) => void
    clear: () => void
  }
  /** The items come A to Z, not in the book's order (a tree listing's List): the note says so. */
  byName?: boolean
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
  byName = false,
}: IndexLedgerProps) {
  const surface = useEntitySurface()
  // The listing's own order (the book's) until the reader sorts.
  const [ownSort, setOwnSort] = useState<LedgerSort | undefined>(undefined)
  const sort = order ? order.sort : ownSort
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
    const rowOf = new Map(built.map((row) => [row.id, row]))
    return sortModels(models, columns, schemaId, sort).flatMap(({ item }) => {
      const row = rowOf.get(item.id)
      return row ? [row] : []
    })
  }, [built, models, columns, schemaId, sort])
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
  const measures = (key: string | undefined) =>
    key === SORT_TECH_LEVEL ||
    columns.find((column) => column.key === key)?.kind === 'figure' ||
    ['range', 'damage'].includes(key ?? '')
  const measured = measures(sort?.key)
  // A measure's first press is highest first: the biggest is nearly always the question.
  const sortBy = (key: string) =>
    order
      ? order.sortBy(key, measures(key))
      : setOwnSort((now) => ({
          key,
          descending: now?.key === key ? !now.descending : measures(key),
        }))
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
          {sorted ? (
            sortedLine(sorted)
          ) : (
            <span>
              {islandsCopy(byName ? 'azOrder' : 'bookOrder')}{' '}
              {/* A phone's row with no column beside its name has none to press (RR2-17). */}
              <span className={onPhone.length === 0 ? 'su-listing__sort-hint' : undefined}>
                {islandsCopy('sortHint')}
              </span>
            </span>
          )}
          {sort && order && (
            <Button variant="ghost" size="compact" onClick={order.clear}>
              {islandsCopy(byName ? 'backToAzOrder' : 'backToBookOrder')}
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
