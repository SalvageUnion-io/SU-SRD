/**
 * TokenGrid — a list of contentful Tokens (N3) as a masonry grid (owner's
 * call, 2026-10-20): a pilot's abilities, an NPC's actions, a mech's systems
 * and modules, a pattern's loadout. Each Token is its head and then its text,
 * so Tokens differ in height; the grid deals them into columns that each run
 * their own height, with no ragged gaps between rows.
 *
 * - **A real list** (`ul` of `li`), so a screen reader announces its count,
 *   and every gate that reads a list item reads each Token.
 * - **Columns by the room it has**, not the viewport: a column is at least
 *   18rem and there are three at most, so the grid is one column in a
 *   sidebar, a card or on a phone, and two or three across a page's main
 *   column. It is CSS multi-column (`.su-token-grid`): these lists are a few
 *   dozen Tokens at most, so the reflow `MasonryColumns` avoids for a large
 *   catalogue costs nothing here, and it reads down each column in order.
 * - **Edit** (`edit`) makes it a sheet's item list (`.su-sheet-items`), each
 *   line's controls in its Token's chip group.
 * - **Play** (`play`) marks it one of Play's lists (`data-play-list`, play.md
 *   §12): its Tokens' chips stay Mini on Play's phone, their heads and
 *   controls each taking a 44px hit area (`play/dashboard/phone.css`).
 *
 * Each child is one `li`; it may hold what belongs on the Token's line under
 * it (an action's roll table), never a second Token.
 */

import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type TokenGridProps = {
  /** The list's accessible name ("Systems installed"). */
  label: string
  /** One `li` a Token. */
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

export function TokenGrid({
  label,
  children,
  edit = false,
  play = false,
  id,
  className,
  style,
}: TokenGridProps) {
  return (
    <ul
      id={id}
      aria-label={label}
      data-play-list={play ? '' : undefined}
      className={cn('su-token-grid', edit && 'su-sheet-items', className)}
      style={style}
    >
      {children}
    </ul>
  )
}
