/**
 * ShelfItem — one thing on a shelf (the Training Bay): the library Compact a
 * Game's roster draws the same units with (`UnitRow`), the whole Compact opening
 * it. Its chips are the defining fact (never its kind, EDL E9) and one
 * reading, label-first (`CLASS | ENGINEER`, `HP | 8/10`), led by this item's
 * own chips (for a pattern or NPC, who can see it) as label-only chips, the
 * way a Game's Compact leads with its owner chip (never boxes under the card,
 * R6); then its relations, the units linked to it and
 * the Game it is in (`GAME | Rust Run`, opening that Game's page in Play,
 * C11); and its "⋯" menu, an action chip, last on the name's line.
 *
 * The menu's rows are the caller's (`menu`): what an item may do depends on its
 * kind and on whether this session can write, and every verb that asks first
 * opens the page's one confirm, which has to outlive the menu that asked.
 *
 * **User-made** (ruleset §3.9): a pattern or an NPC is something a player made
 * that could pass for the book, so its frame is dashed and its name is quoted
 * as a pattern's is. Pilots, mechs and crawlers built from canon stay solid.
 */

import type { CSSProperties } from 'react'
import type { HeaderMenuItem, LinkedUnit } from '../../components/index'
import { HeaderMenu, relation, Stat } from '../../components/index'
import { UnitRow } from '../../components/shared/UnitRow'
import type { ShelfChip, ShelfRelation } from '../../lib/shelves/shelfItems'
import type { UnitKind, UnitReading } from '../../lib/units/unitModel'

const ITEM = { listStyle: 'none', minWidth: 0 } satisfies CSSProperties

/** What the defining fact is, per kind; an NPC's position goes unlabelled (a stamp). */
const FACT_LABEL: Partial<Record<UnitKind, string>> = {
  crawler: 'Type',
  mech: 'Chassis',
  pattern: 'Chassis',
  pilot: 'Class',
}

type ShelfItemProps = {
  kind: UnitKind
  /** What it is built as ("Engineer"), never its kind: a fact chip, else a stamp. */
  note?: string | undefined
  name: string
  reading?: UnitReading | undefined
  href?: string
  userMade?: boolean
  chips: ShelfChip[]
  /** The units linked to it, as Minis leading its body (`crewLinked`). */
  linked?: LinkedUnit[]
  /** The Game it is in, as a relation chip (C11). */
  relations?: ShelfRelation[]
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
  linked = [],
  relations = [],
  menu,
}: ShelfItemProps) {
  const hasMenu = menu.some((section) => section.length > 0)
  const factLabel = FACT_LABEL[kind]
  const fact = note && factLabel ? { label: factLabel, value: note } : undefined
  return (
    <li style={ITEM}>
      <UnitRow
        kind={kind}
        note={fact ? undefined : note}
        name={name}
        readings={[fact, reading].filter((r) => r !== undefined)}
        // A line with nowhere to open is not a link.
        mode={href === undefined ? { kind: 'read' } : { kind: 'link', href }}
        userMade={userMade}
        relations={relations.map((r) => relation(r.key, r.label, r.value, { href: r.href }))}
        linked={linked}
        labels={
          chips.length > 0
            ? chips.map((chip) => (
                <Stat key={chip.key} label={chip.label} value={chip.value} size="compact" />
              ))
            : undefined
        }
        trailing={
          hasMenu ? (
            <HeaderMenu
              variant="overflow"
              trigger={null}
              label={`More for ${name}`}
              sections={menu}
            />
          ) : undefined
        }
      />
    </li>
  )
}
