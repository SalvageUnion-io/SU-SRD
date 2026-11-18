// MOCK (Working Manual, wave 2): a Training Bay shelf as a LEDGER (the reading
// lane's `components/entity/Ledger.tsx`), one framed list a kind in that
// kind's band paint: the shelf's name on the head strip's paper cut-out, its
// columns as mini ink stamps, its one make (`+ New pilot`, rust) on a second
// cut-out at the strip's end, then a Mini-height line a unit: its name the
// link to its sheet, what it is and its live readings in fixed columns, the
// unit it is paired with and its Game as links, and its ⋯ menu at the line's
// end. It replaces a Slab over a stack of Compacts, each with its own band and
// its own chip strip (`Shelf`, `ShelfItem`), whose lanes ran ragged.
import type { ReactNode } from 'react'
import { paintFor } from '../../components/entity/index'
import type { LedgerColumn } from '../../components/entity/Ledger'
import { Ledger } from '../../components/entity/Ledger'
import type { HeaderMenuItem } from '../../components/index'
import { HeaderMenu, Text } from '../../components/index'
import { buildShelvesCopy } from '../../messages/build-shelves'

export type ShelfLedgerRow = {
  id: string
  name: string
  /** Its sheet; without one the name is plain. */
  href?: string | undefined
  /** One a column; `''` draws a dash. */
  cells: readonly ReactNode[]
  /** Its own labels (`Shared by link`), under its name. */
  under?: ReactNode
  /** The ⋯ menu's rows, grouped; empty draws no menu. */
  menu: HeaderMenuItem[][]
}

type ShelfLedgerProps = {
  /** The region's id, for the page's links. */
  id: string
  /** The shelf's name, on the head's cut-out ("Pilots"). */
  title: string
  /** The kind's tone token (`pilot`, `mech`, `crawler`); `ink` for what a player made. */
  tone: string
  columns: readonly LedgerColumn[]
  rows: readonly ShelfLedgerRow[]
  /** The shelf's one make, at the head strip's end. */
  action?: ReactNode
  /** Said when the shelf is bare (`No pilots yet.`). */
  empty: string
  /** What the shelf is for, under it. */
  note?: string
}

/** A cell that opens something (the paired unit, the Game). */
export function ShelfLink({ href, children }: { href: string | undefined; children: ReactNode }) {
  if (!href) return <>{children}</>
  return (
    <a href={href} className="su-ledger__link su-ledger__link--cell">
      {children}
    </a>
  )
}

export function ShelfLedger({
  id,
  title,
  tone,
  columns,
  rows,
  action,
  empty,
  note,
}: ShelfLedgerProps) {
  return (
    <section id={id} aria-label={title} className="su-shelf-ledger">
      <Ledger
        label={title}
        paint={paintFor(tone, { texture: true })}
        nameLabel={title}
        count={rows.length}
        columns={columns}
        rows={rows.map((row) => ({
          id: row.id,
          name: row.name,
          entityRef: undefined,
          ...(row.href ? { href: row.href } : {}),
          cells: row.cells,
          ...(row.under ? { under: row.under } : {}),
          trailing: row.menu.some((section) => section.length > 0) ? (
            <HeaderMenu
              variant="overflow"
              trigger={null}
              label={buildShelvesCopy('moreFor', { name: row.name })}
              sections={row.menu}
            />
          ) : undefined,
        }))}
        action={action}
        empty={empty}
      />
      {note && <Text variant="hint">{note}</Text>}
    </section>
  )
}
