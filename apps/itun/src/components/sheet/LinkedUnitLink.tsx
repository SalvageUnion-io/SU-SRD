/**
 * LinkedUnitLink — a linked unit in a sheet's read state (board 10, issue
 * 1255): the entity display language's ROW (`<Entity form="row">`) in link
 * mode. The kind stamp rides the top edge, the band is the unit's own tone
 * with its name, its first reading (`SP 9/9`) is the body's Stat, and the
 * whole Row opens that unit's sheet.
 *
 * Edit state keeps the full `EntityRow`, whose Assign and Unassign controls
 * are writes. Reading a sheet only needs to know what is linked and how it is
 * doing, so the Row carries nothing else.
 */

import { Entity } from 'component-lib'
import type { SheetEntityKind } from '../../lib/schemas/entity'
import { unitRowModel } from '../../lib/units/unitModel'

type LinkedUnitLinkProps = {
  kind: SheetEntityKind
  name: string
  /** The unit's sheet; without one the Row is not a link. */
  href: string | undefined
  /** Its readings; the first one shows. */
  stats: { label: string; value: string }[]
}

export function LinkedUnitLink({ kind, name, href, stats }: LinkedUnitLinkProps) {
  const reading = stats[0]
  return (
    <Entity
      form="row"
      model={unitRowModel({ kind, stamp: kind, name, readings: reading ? [reading] : [] })}
      mode={
        href === undefined
          ? { kind: 'read' }
          : { kind: 'link', href, attrs: { 'aria-label': `View ${name}` } }
      }
    />
  )
}
