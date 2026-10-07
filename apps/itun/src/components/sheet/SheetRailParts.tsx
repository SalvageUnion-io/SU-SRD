/**
 * SheetRailParts — the rail's CTA button, and its row for a unit it may only
 * name.
 *
 * `RailStatLine` lived here and is gone: the linked-unit slots render the
 * roster's `EntityRow` now, which takes flat `label | value` stat cells, so the
 * running-text join it existed to produce has no consumer. `rowStats`
 * (railStats.ts) is the adapter that replaced it.
 */

import { buttonVariants, cn, EntityRow } from 'component-lib'
import { AppLink } from '../shared/AppLink'
import type { WithheldUnit } from './sheetViewProps'

/**
 * A linked unit the reader may not see — a public sheet's assignment to
 * something that is not published itself. It fills the slot its kind would (so
 * the rail never says "no mech assigned" of a pilot who has one) and says only
 * "Not shared": no name, no vitals, no View. A published unit this app cannot
 * render keeps its name, and says that instead.
 */
export function WithheldUnitRow({ unit, label }: { unit: WithheldUnit; label: string }) {
  return (
    <EntityRow
      entityType={unit.kind}
      className="flex-[1_1_0%]"
      name={unit.name ?? 'Not shared'}
      meta={label}
      metaLine={unit.name === undefined ? undefined : 'Can’t be shown'}
    />
  )
}

/** Anchor CTA for rail empty slots ('+ Create'). */
export function RailCta({
  href,
  label,
  primary,
}: {
  href: string
  label: string
  primary?: boolean
}) {
  return (
    <AppLink
      href={href}
      className={cn(
        buttonVariants({ variant: primary ? 'primary' : 'default', size: 'compact' }),
        'no-underline'
      )}
    >
      {label}
    </AppLink>
  )
}
