/**
 * AssignedUnits — a sheet's Assigned units section (hard rule R5,
 * `chips-and-actions.md` C11): each linked unit is one RELATION chip, label
 * first (`MECH | Mazona`, `CRAWLER | Tenacity`), whose value opens that unit's
 * sheet. Read and Edit draw the same chip; Edit inlines the link's controls
 * after it (C8: Change, Unassign). In Edit each place still to fill is a
 * placeholder Mini of its kind ("No Mech assigned") with the ways to fill
 * it, Assign and + Create, as its controls (owner's review, 2026-10-20: the
 * Assign buttons are mock entity rows with their controls inside). No role
 * stamp ("Assigned Mech"): an absent relation leaves no chip, and Read leaves
 * the section out when nothing is linked (`hasAssignedUnits`).
 *
 * The one section every kind draws, pilot, mech and crawler, with its one
 * body class (`.su-sheet-linked`).
 */

import type { SheetKind } from 'game-domain/entityKinds'
import { Unlink } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Fragment } from 'react'
import { Button, Entity, relation, SlabSection, Tags, tokens } from '../../components/index'
import { unitRowModel } from '../../lib/units/unitModel'

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
  /** What stands in while it is empty (a pilot's hand-set crawler level), in the body. */
  extra?: ReactNode
  /** The placeholder's name; `No <Kind> assigned` by default. */
  placeholder?: string
}

const LINE = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  minWidth: 0,
} satisfies CSSProperties

const NEW_PATH: Record<SheetKind, string> = {
  pilot: '/pilots/new',
  mech: '/mechs/new',
  crawler: '/crawlers/new',
}

const KIND_NAME: Record<SheetKind, string> = {
  pilot: 'Pilot',
  mech: 'Mech',
  crawler: 'Crawler',
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
  const open = editable ? slots : []
  return (
    <SlabSection
      fold="open"
      id="linked-units"
      title="Assigned units"
      bodyClassName="su-sheet-linked"
    >
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
      {/* Each place to fill, a placeholder of its kind with Assign and
          + Create inside it; what stands in for it (a stepper is not a
          button's Size, C1a) under it. */}
      {open.map((slot) => (
        <Fragment key={slot.key}>
          <Entity
            size="mini"
            context="roster"
            model={unitRowModel({
              kind: slot.kind,
              name: slot.placeholder ?? `No ${KIND_NAME[slot.kind]} assigned`,
            })}
            controls={
              <>
                {slot.assign}
                <Button href={NEW_PATH[slot.kind]} size="mini">
                  + Create
                </Button>
              </>
            }
          />
          {slot.extra}
        </Fragment>
      ))}
    </SlabSection>
  )
}
