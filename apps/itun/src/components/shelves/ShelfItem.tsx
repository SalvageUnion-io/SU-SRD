/**
 * ShelfItem — one thing on a shelf (Shelves, board S1): its one-line card
 * (`ShelfPill`), the chips under it — the Game it is in, the units linked to
 * it, where it came from, and for a pattern who can see it — and its "⋯" menu
 * at the shelf's edge.
 *
 * The menu's rows are the caller's (`menu`): what an item may do depends on its
 * kind and on whether this session can write, and every verb that asks first
 * opens the page's one confirm, which has to outlive the menu that asked.
 */

import { tokens } from 'component-lib'
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

const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[6],
  minWidth: 0,
} satisfies CSSProperties

const CHIPS = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[6],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

/** A chip: a small paper pill in ink, sentence case — it is a note, not a stamp. */
const CHIP = {
  backgroundColor: tokens.color.paper,
  borderColor: tokens.color.ink,
  borderRadius: tokens.radius.full,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.chrome,
  color: tokens.color.ink,
  display: 'inline-block',
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.note,
  fontWeight: tokens.weight.semibold,
  lineHeight: 1.3,
  maxWidth: '100%',
  overflow: 'hidden',
  padding: `1px ${tokens.space[8]}`,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

type ShelfItemProps = {
  kind: ShelfKind
  kicker: string
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
  kicker,
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
          kicker={kicker}
          name={name}
          reading={reading}
          href={href}
          userMade={userMade}
        />
        {chips.length > 0 && (
          <ul style={CHIPS} aria-label={`About ${name}`}>
            {chips.map((chip) => (
              <li key={chip.key} style={CHIP}>
                {chip.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {hasMenu && (
        <HeaderMenu variant="overflow" trigger={null} label={`More for ${name}`} sections={menu} />
      )}
    </li>
  )
}
