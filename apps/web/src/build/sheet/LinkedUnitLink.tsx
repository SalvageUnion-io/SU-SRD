/**
 * LinkedUnitLink — a unit linked to what holds it, wherever a sheet names one
 * outside its Assigned units (the Hold's stow target, the Mech Bay's docked
 * mech): a header-only Mini of its kind, never a chip (owner, 2026-10-20:
 * "References to other units should always be compact or mini references,
 * no chips"), its name opening that unit's sheet. No readings: what it is
 * doing is its own sheet's.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import { Entity } from '../../components/index'
import { unitRowModel } from '../../lib/units/unitModel'

type LinkedUnitLinkProps = {
  kind: SheetKind
  name: string
  /** The unit's sheet; without one the Mini opens nothing. */
  href: string | undefined
}

export function LinkedUnitLink({ kind, name, href }: LinkedUnitLinkProps) {
  return (
    <Entity
      size="mini"
      context="roster"
      model={unitRowModel({ kind, name })}
      {...(href ? { mode: { kind: 'link' as const, href } } : {})}
    />
  )
}
