/**
 * ShelfPill — an item on a shelf as one line (Shelves, board S1): the entity
 * display language's TOKEN (`<Entity form="token">`) for things a player
 * keeps. A tone fill in the unit's colour, an ink stamp with its kind and
 * defining fact ("PILOT · ENGINEER"), its name, and one reading (`HP 8/10`),
 * framed in ink; the whole line opens it.
 *
 * A pilot, mech or crawler on a shelf is the player's own build, which no
 * reference record describes, so its model is `unitRowModel` rather than
 * `toEntityModel` — the same form, fed the unit's own facts.
 *
 * **User-made** (ruleset §3.9): a pattern or an NPC is something a player made
 * that could pass for the book, so its frame is dashed and its name is quoted
 * as a pattern's is. Pilots, mechs and crawlers built from canon stay solid.
 */

import { Entity } from 'component-lib'
import type { ShelfReading } from '../../lib/shelves/shelfItems'
import type { UnitKind } from '../../lib/units/unitModel'
import { unitRowModel } from '../../lib/units/unitModel'

export type ShelfKind = UnitKind

type ShelfPillProps = {
  kind: ShelfKind
  /** The stamp: "Pilot · Engineer". */
  kicker: string
  name: string
  reading?: ShelfReading
  /** Where the line opens; a line with nowhere to open is not a link. */
  href?: string
  /** A pattern or an NPC: dashed, its name quoted (ruleset §3.9). */
  userMade?: boolean
}

export function ShelfPill({ kind, kicker, name, reading, href, userMade = false }: ShelfPillProps) {
  return (
    <Entity
      form="token"
      model={unitRowModel({ kind, stamp: kicker, name, userMade })}
      fact={reading ?? null}
      mode={href === undefined ? { kind: 'read' } : { kind: 'link', href }}
    />
  )
}
