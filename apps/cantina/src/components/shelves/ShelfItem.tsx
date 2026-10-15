/**
 * ShelfItem — one thing on a shelf (Shelves, board S1): its one-line card
 * (`ShelfPill`), whose chip group leads with this item's chips — the Game it
 * is in, the units linked to it, and for a pattern or NPC who can see it — as
 * label-only chips, the way a Game's Row leads with its owner chip
 * (never boxes under the card; owner's rule, 2026-10-14) — and its "⋯" menu at
 * the shelf's edge.
 *
 * The menu's rows are the caller's (`menu`): what an item may do depends on its
 * kind and on whether this session can write, and every verb that asks first
 * opens the page's one confirm, which has to outlive the menu that asked.
 */

import { Stat, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import type { ShelfChip, ShelfReading } from '../../lib/shelves/shelfItems'
import type { HeaderMenuItem } from '../shared/HeaderMenu'
import { HeaderMenu } from '../shared/HeaderMenu'
import type { ShelfKind } from './ShelfPill'
import { ShelfPill } from './ShelfPill'

const ITEM = {
  alignItems: 'start',
  display: 'grid',
  gap: tokens.space[12],
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  listStyle: 'none',
} satisfies CSSProperties

const BODY = { minWidth: 0 } satisfies CSSProperties

type ShelfItemProps = {
  kind: ShelfKind
  note?: string | undefined
  name: string
  reading?: ShelfReading
  href?: string
  userMade?: boolean
  chips: ShelfChip[]
  /** The "⋯" menu's rows, grouped; empty renders no menu. */
  menu: HeaderMenuItem[][]
}

export function ShelfItem({
  kind,
  note,
  name,
  reading,
  href,
  userMade,
  chips,
  menu,
}: ShelfItemProps) {
  const hasMenu = menu.some((section) => section.length > 0)
  return (
    <li style={ITEM}>
      <div style={BODY}>
        <ShelfPill
          kind={kind}
          note={note}
          name={name}
          reading={reading}
          href={href}
          userMade={userMade}
          labels={
            chips.length > 0
              ? chips.map((chip) => (
                  <Stat
                    key={chip.key}
                    orientation="horizontal"
                    label={chip.label}
                    value={chip.value}
                    hollow={chip.hollow}
                    size="compact"
                  />
                ))
              : undefined
          }
        />
      </div>
      {hasMenu && (
        <HeaderMenu variant="overflow" trigger={null} label={`More for ${name}`} sections={menu} />
      )}
    </li>
  )
}
