import type { UnitKind } from '../../lib/units/unitModel'
import { unitRowModel } from '../../lib/units/unitModel'
import { Entity } from './Entity'

/** One unit linked to the one drawn: its kind, its name, and its sheet. */
export type LinkedUnit = {
  key: string
  kind: UnitKind
  name: string
  /** Its sheet; without one the Mini opens nothing. */
  href?: string | undefined
}

/**
 * The units an entity is linked to (a pilot's mech, a mech's pilot), each a
 * header-only Mini of its kind, never a chip (owner, round 4: "no linked units
 * should be chips. all should be entities"), its name opening that unit's
 * sheet. They lead the entity's body (`<Entity linked>`): a Compact's children
 * as Minis (E6), and a Mini's the one named exception (hard rules).
 */
export function LinkedUnits({ linked }: { linked: readonly LinkedUnit[] }) {
  return (
    <div className="su-entity-linked" data-entity-linked="">
      {linked.map((unit) => (
        <Entity
          key={unit.key}
          size="mini"
          context="roster"
          model={unitRowModel({ kind: unit.kind, name: unit.name })}
          {...(unit.href ? { mode: { kind: 'link' as const, href: unit.href } } : {})}
        />
      ))}
    </div>
  )
}
