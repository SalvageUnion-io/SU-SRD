// A Training Bay shelf as a Ledger (`components/entity/Ledger.tsx`), one
// framed list a kind in that kind's band paint: the shelf's name on the head
// strip's paper cut-out, its columns as mini ink stamps, its one make
// (`+ New pilot`, rust) on a second cut-out at the strip's end, then a
// Mini-height line a unit: its name the link to its sheet, what it is and its
// live readings in fixed columns, the unit it is paired with and its Game as
// links, and its ⋯ menu at the line's end. A shelf of things a player made
// that could pass for canon (patterns, NPCs) wears the one dashed HOMEBREW
// stamp beside its tab (ruleset §3.9, ledger.md L9).
import type { ReactNode } from 'react'
import type { HeaderMenuItem, LedgerColumn } from '../../components/index'
import { Button, HeaderMenu, HomebrewStamp, InlineRef, Ledger, Text } from '../../components/index'
import { buildShelvesCopy } from '../../messages/build-shelves'

type ShelfLedgerRow = {
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
  /** Its Play door (a pilot's Cockpit), before the ⋯ menu. */
  play?: string
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
  /** A shelf of player-made designs: the dashed HOMEBREW stamp beside its tab. */
  homebrew?: boolean
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
  return <InlineRef href={href}>{children}</InlineRef>
}

/** A line's end: its Play door, then its ⋯ menu; neither draws nothing. */
function trailingOf(row: ShelfLedgerRow): ReactNode {
  const menu = row.menu.some((section) => section.length > 0)
  if (!row.play && !menu) return undefined
  return (
    <span className="su-ledger__trailing-line">
      {row.play && (
        <Button
          href={row.play}
          variant="primary"
          size="compact"
          aria-label={buildShelvesCopy('playName', { name: row.name })}
        >
          {buildShelvesCopy('play')}
        </Button>
      )}
      {menu && (
        <HeaderMenu
          variant="overflow"
          trigger={null}
          label={buildShelvesCopy('moreFor', { name: row.name })}
          sections={row.menu}
        />
      )}
    </span>
  )
}

/** A cell with something to say; a `0` is a value. */
const filled = (cell: ReactNode) =>
  cell !== '' && cell !== null && cell !== undefined && cell !== false

export function ShelfLedger({
  id,
  title,
  tone,
  columns,
  rows,
  homebrew,
  action,
  empty,
  note,
}: ShelfLedgerProps) {
  // A list drops a column no row fills (ledger.md L5): the rest keep their order.
  const kept = columns.flatMap((column, index) =>
    rows.some((row) => filled(row.cells[index])) ? [{ column, index }] : []
  )
  return (
    <section id={id} aria-label={title} className="su-shelf-ledger">
      <Ledger
        label={title}
        tone={tone}
        nameLabel={title}
        count={rows.length}
        {...(homebrew ? { mark: <HomebrewStamp size="mini" /> } : {})}
        columns={kept.map(({ column }) => column)}
        rows={rows.map((row) => ({
          id: row.id,
          name: row.name,
          entityRef: undefined,
          ...(row.href ? { href: row.href } : {}),
          cells: kept.map(({ index }) => row.cells[index]),
          ...(row.under ? { under: row.under } : {}),
          trailing: trailingOf(row),
        }))}
        action={action}
        empty={empty}
      />
      {note && <Text variant="note">{note}</Text>}
    </section>
  )
}
