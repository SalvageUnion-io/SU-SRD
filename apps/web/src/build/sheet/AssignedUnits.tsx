/**
 * AssignedUnits — a sheet's Assigned units section (hard rule R5,
 * `chips-and-actions.md` C11): each linked unit is one RELATION chip, label
 * first (`MECH | Mazona`, `CRAWLER | Tenacity`), whose value opens that unit's
 * sheet. Read and Edit draw the same chip; Edit inlines the link's controls
 * after it (C8: Change, Unassign), and puts the ways to fill a kind (Assign,
 * + Create) on a line of their own. No role stamp ("Assigned Mech"), no Row,
 * no Token: an absent relation leaves no chip, and Read leaves the section out
 * when nothing is linked (`hasAssignedUnits`).
 *
 * The one section every kind draws, pilot, mech and crawler, with its one
 * body class (`.su-sheet-linked`).
 */

import type { SheetKind } from 'game-domain/entityKinds'
import { Unlink } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import {
  Button,
  buttonVariants,
  relation,
  SheetSectionSlab,
  Tags,
  tokens,
} from '../../components/index'
import { AppLink } from '../../components/shared/AppLink'

/** One linked unit: what it is to this sheet, its name, and where its sheet is. */
export type AssignedUnit = {
  key: string
  /** The relation's label, the unit's kind: 'Pilot', 'Mech', 'Crawler'. */
  label: string
  /** Its name; a withheld unit on a public sheet says "Not shared". */
  name: string
  /** Its sheet; without one the chip opens nothing (a withheld unit). */
  href?: string
  /** Edit: Change, the picker that replaces it (before Unassign). */
  change?: ReactNode
  /** Edit: take the link off (never the unit). */
  onUnassign?: () => void
}

/** Edit: how a kind's place is filled, when it is empty or takes more than one. */
export type AssignedSlot = {
  key: string
  kind: SheetKind
  /** Assign one that exists (`AssignPicker`). */
  assign: ReactNode
  /** What stands in while it is empty (a pilot's hand-set crawler level). */
  extra?: ReactNode
}

const LINE = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  minWidth: 0,
} satisfies CSSProperties

/** An empty place: what stands in, then its line of controls. */
const SLOT = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  minWidth: 0,
} satisfies CSSProperties

const CREATE = { textDecoration: 'none' } satisfies CSSProperties

const NEW_PATH: Record<SheetKind, string> = {
  pilot: '/pilots/new',
  mech: '/mechs/new',
  crawler: '/crawlers/new',
}

/** Whether the section draws at all: Read leaves it out with nothing linked. */
function hasAssignedUnits(units: readonly AssignedUnit[], editable: boolean): boolean {
  return editable || units.length > 0
}

export function AssignedUnits({
  units,
  slots = [],
  editable,
}: {
  units: readonly AssignedUnit[]
  slots?: readonly AssignedSlot[]
  editable: boolean
}) {
  if (!hasAssignedUnits(units, editable)) return null
  return (
    <SheetSectionSlab id="linked-units" title="Assigned units" bodyClassName="su-sheet-linked">
      {units.map((unit) => (
        <div key={unit.key} style={LINE} data-assigned-unit="">
          <Tags
            tags={[relation(unit.key, unit.label, unit.name, { href: unit.href })]}
            linkable
            size="compact"
          />
          {editable && unit.change}
          {editable && unit.onUnassign && (
            <Button
              variant="ghost"
              size="compact"
              aria-label={`Unassign ${unit.name}`}
              onClick={unit.onUnassign}
              glyph={<Unlink size={tokens.iconSize.compact} aria-hidden="true" />}
            >
              Unassign
            </Button>
          )}
        </div>
      ))}
      {editable &&
        slots.map((slot) => (
          <div key={slot.key} style={SLOT}>
            {/* What stands in sits on its own line: a stepper is not a button's Size (C1a). */}
            {slot.extra}
            <div style={LINE}>
              {slot.assign}
              <AppLink
                href={NEW_PATH[slot.kind]}
                className={buttonVariants({ variant: 'default', size: 'compact' })}
                style={CREATE}
              >
                + Create
              </AppLink>
            </div>
          </div>
        ))}
    </SheetSectionSlab>
  )
}
