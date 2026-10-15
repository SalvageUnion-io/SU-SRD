/**
 * ShelfPill — an item on a shelf (Shelves, board S1): the library Row
 * (`<Entity form="row">`), as a Game's roster draws the same units. The band
 * in the unit's colour, its name on the paper cut-out, and right of it the
 * defining fact (never its kind, EDL E9) and one reading as label-first chips
 * (`CLASS | ENGINEER`, `HP | 8/10`); the whole Row opens it. The host's chips
 * (the Game it is in, what it is linked to) lead that chip group, label-only,
 * as a Game's owner chip does, and its "⋯" menu ends it.
 *
 * A pilot, mech or crawler on a shelf is the player's own build, which no
 * reference record describes, so its model is `unitRowModel` rather than
 * `toEntityModel` — the same form, fed the unit's own facts.
 *
 * **User-made** (ruleset §3.9): a pattern or an NPC is something a player made
 * that could pass for the book, so its frame is dashed and its name is quoted
 * as a pattern's is. Pilots, mechs and crawlers built from canon stay solid.
 */

import type { ReactNode } from 'react'
import { Entity } from '../../../ui/index'
import type { ShelfReading } from '../../lib/shelves/shelfItems'
import type { UnitKind } from '../../lib/units/unitModel'
import { unitRowModel } from '../../lib/units/unitModel'

export type ShelfKind = UnitKind

type ShelfPillProps = {
  kind: ShelfKind
  /** The stamp: what it is built as ("Engineer"), never its kind. */
  note?: string | undefined
  name: string
  reading?: ShelfReading
  /** Where the line opens; a line with nowhere to open is not a link. */
  href?: string
  /** A pattern or an NPC: dashed, its name quoted (ruleset §3.9). */
  userMade?: boolean
  /** The host's chips (where it is, what it is linked to): the first of the Row's chips. */
  labels?: ReactNode
  /** The host's last chip: the item's "⋯" menu. */
  trailing?: ReactNode
}

/** What the defining fact is, per kind; an NPC's position goes unlabelled. */
const FACT_LABEL: Partial<Record<ShelfKind, string>> = {
  crawler: 'Type',
  mech: 'Chassis',
  pattern: 'Chassis',
  pilot: 'Class',
}

export function ShelfPill({
  kind,
  note,
  name,
  reading,
  href,
  userMade = false,
  labels,
  trailing,
}: ShelfPillProps) {
  const factLabel = FACT_LABEL[kind]
  const fact = note && factLabel ? { label: factLabel, value: note } : undefined
  const readings = [fact, reading].filter((r) => r !== undefined)
  return (
    <Entity
      form="row"
      model={unitRowModel({ kind, note: fact ? undefined : note, name, userMade, readings })}
      mode={href === undefined ? { kind: 'read' } : { kind: 'link', href }}
      labels={labels}
      trailing={trailing}
    />
  )
}
