/**
 * LinkedUnitLink — a unit linked to what holds it, wherever a sheet names one
 * outside its Assigned units (the Hold's stow target, the Mech Bay's docked
 * mech): the one RELATION chip (hard rule R5, `chips-and-actions.md` C11),
 * label first, `CRAWLER | Tenacity`, its value opening that unit's sheet. No
 * Mini, no readings: what it is doing is its own sheet's.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import { relation, Tags } from '../../components/index'

const LABEL: Record<SheetKind, string> = { pilot: 'Pilot', mech: 'Mech', crawler: 'Crawler' }

type LinkedUnitLinkProps = {
  kind: SheetKind
  name: string
  /** The unit's sheet; without one the chip opens nothing. */
  href: string | undefined
}

export function LinkedUnitLink({ kind, name, href }: LinkedUnitLinkProps) {
  return <Tags tags={[relation(kind, LABEL[kind], name, { href })]} linkable size="compact" />
}
