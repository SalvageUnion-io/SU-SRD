import type { UnitKind, UnitReading } from '../../lib/units/unitModel'
import { unitRowModel } from '../../lib/units/unitModel'
import { Entity } from './Entity'
import type { TagItem } from './parts/tagItems'

/** One unit linked to the one drawn: its kind, its name, and its sheet. */
export type LinkedUnit = {
  key: string
  kind: UnitKind
  name: string
  /** Its sheet; without one the Mini opens nothing. */
  href?: string | undefined
  /** Its live readings (`SP | 9/16`), its chips' measures. */
  readings?: readonly UnitReading[] | undefined
  /** What it is paired with (`PILOT | Bonesaw`), relation chips after its readings (C11). */
  relations?: readonly TagItem[] | undefined
}

/**
 * The units an entity is linked to (a pilot's mech, a mech's pilot), each a
 * header-only Mini of its kind, never a chip (R5), its name opening that
 * unit's sheet, its readings and pairing as its chips. They lead the entity's
 * body (`<Entity linked>`): a
 * Compact's children as Minis (E6), and a Mini's the one named exception
 * (hard rules). A pilot and its mech are one Mini (`crewPair`).
 */
export function LinkedUnits({ linked }: { linked: readonly LinkedUnit[] }) {
  return (
    <div className="su-entity-linked" data-entity-linked="">
      {linked.map((unit) => (
        <Entity
          key={unit.key}
          size="mini"
          context="roster"
          model={unitRowModel({ kind: unit.kind, name: unit.name, readings: unit.readings ?? [] })}
          {...(unit.relations?.length ? { relations: [...unit.relations] } : {})}
          {...(unit.href ? { mode: { kind: 'link' as const, href: unit.href } } : {})}
        />
      ))}
    </div>
  )
}
