/**
 * LinkedUnitLink — a linked unit in a sheet's read state (board 10, issue
 * 1255): the entity display language's TOKEN (`<Entity form="token">`) in
 * link mode (owner's call, 2026-10-14: a sheet's Assigned Units are Tokens,
 * not Rows). The pill is the unit's own tone with its name, its first
 * reading (`SP 9/9`) its chip, and the whole Token opens that unit's sheet.
 *
 * Edit state keeps the full Row (`UnitRow`), whose Assign and Unassign controls
 * are writes. Reading a sheet only needs to know what is linked and how it is
 * doing, so the Token carries nothing else.
 */

import type { SheetEntityKind } from 'cantina-domain/schemas/entity'
import { Entity } from '../../../ui/index'
import { unitRowModel } from '../../lib/units/unitModel'

type LinkedUnitLinkProps = {
  kind: SheetEntityKind
  name: string
  /** The unit's sheet; without one the Token is not a link. */
  href: string | undefined
  /** Its readings; the first one shows. */
  stats: { label: string; value: string }[]
}

export function LinkedUnitLink({ kind, name, href, stats }: LinkedUnitLinkProps) {
  const reading = stats[0]
  return (
    <Entity
      form="token"
      model={unitRowModel({ kind, name, readings: reading ? [reading] : [] })}
      mode={
        href === undefined
          ? { kind: 'read' }
          : { kind: 'link', href, attrs: { 'aria-label': `View ${name}` } }
      }
    />
  )
}
