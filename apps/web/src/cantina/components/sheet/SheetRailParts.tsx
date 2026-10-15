/**
 * SheetRailParts — the rail's CTA button, and its row for a unit it may only
 * name.
 *
 * The linked-unit slots are the library Row (`UnitRow`), which takes flat
 * `label | value` readings; `rowStats` (railStats.model.ts) adapts a rail
 * stat into one.
 */

import { Badge, buttonVariants } from 'component-lib'
import type { CSSProperties } from 'react'
import { AppLink } from '../shared/AppLink'
import { UnitRow } from '../shared/UnitRow'
import type { WithheldUnit } from './sheetViewProps.model'

const LINK = { textDecoration: 'none' } satisfies CSSProperties

/**
 * A linked unit the reader may not see — a public sheet's assignment to
 * something that is not published itself. It fills the slot its kind would (so
 * the rail never says "no mech assigned" of a pilot who has one) and says only
 * "Not shared": no name, no vitals, no View. A published unit this app cannot
 * render keeps its name, and says that instead.
 */
export function WithheldUnitRow({ unit, label }: { unit: WithheldUnit; label: string }) {
  return (
    <div className="su-sheet-rail-slot">
      <UnitRow
        kind={unit.kind}
        name={unit.name ?? 'Not shared'}
        note={label}
        labels={
          unit.name === undefined ? undefined : (
            <Badge shape="stamp" size="mini" surface="on-ink">
              Can’t be shown
            </Badge>
          )
        }
      />
    </div>
  )
}

/** Anchor CTA for rail empty slots ('+ Create'). */
export function RailCta({ href, primary }: { href: string; primary?: boolean }) {
  return (
    <AppLink
      href={href}
      className={buttonVariants({ variant: primary ? 'primary' : 'default', size: 'compact' })}
      style={LINK}
    >
      + Create
    </AppLink>
  )
}
