/**
 * MiniGrid — a list of contentful Minis (N3) as a masonry grid: a pilot's
 * abilities, an NPC's actions, a mech's systems
 * and modules, a pattern's loadout. Each Mini is its head and then its text,
 * so Minis differ in height; the grid deals them into columns that each run
 * their own height, with no ragged gaps between rows.
 *
 * - **A real list** (`ul` of `li`), so a screen reader announces its count,
 *   and every gate that reads a list item reads each Mini.
 * - **Columns by the room it has**, not the viewport: a column is at least
 *   18rem and there are three at most, so the grid is one column in a
 *   sidebar, a card or on a phone, and two or three across a page's main
 *   column. It is CSS multi-column (`.su-mini-grid`): these lists are a few
 *   dozen Minis at most, so the reflow `MasonryColumns` avoids for a large
 *   catalogue costs nothing here, and it reads down each column in order.
 * - **Edit** (`edit`) makes it a sheet's item list (`.su-sheet-items`), each
 *   line's controls in its Mini's chip group.
 * - **Play** (`play`) marks it one of Play's lists (`data-play-list`, play.md
 *   §12): its Minis' chips stay Mini on Play's phone, their heads and
 *   controls each taking a 44px hit area (`styles/play/phone.css`).
 *
 * Each child is one `li`; it may hold what belongs on the Mini's line under
 * it (an action's roll table), never a second Mini.
 */

import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type MiniGridProps = {
  /** The list's accessible name ("Systems installed"). */
  label: string
  /** One `li` a Mini. */
  children: ReactNode
  /** A live sheet's Edit list: each line carries its controls. */
  edit?: boolean
  /** One of Play's lists (`data-play-list`). */
  play?: boolean
  /** The list's id, for a control that points at it (`aria-controls`). */
  id?: string
  className?: string
  style?: CSSProperties
}

export function MiniGrid({
  label,
  children,
  edit = false,
  play = false,
  id,
  className,
  style,
}: MiniGridProps) {
  return (
    <ul
      id={id}
      aria-label={label}
      data-play-list={play ? '' : undefined}
      className={cn('su-mini-grid', edit && 'su-sheet-items', className)}
      style={style}
    >
      {children}
    </ul>
  )
}
