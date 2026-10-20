/**
 * AssignedUnits — a sheet's Assigned units section (hard rule R5,
 * `chips-and-actions.md` C11): each linked unit is one RELATION chip, label
 * first (`MECH | Mazona`, `CRAWLER | Tenacity`), whose value opens that unit's
 * sheet. Read and Edit draw the same chip; Edit inlines the link's controls
 * after it (C8: Change, Unassign), and puts the ways to fill a kind (Assign,
 * + Create) on the section's head as its `actions` chips — the Creates fold
 * into a ⋯ menu once there are more than three chips. No role stamp ("Assigned Mech"), no Row,
 * no Token: an absent relation leaves no chip, and Read leaves the section out
 * when nothing is linked (`hasAssignedUnits`).
 *
 * The one section every kind draws, pilot, mech and crawler, with its one
 * body class (`.su-sheet-linked`).
 */

import type { SheetKind } from 'game-domain/entityKinds'
import { Unlink } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Fragment } from 'react'
import { Button, HeaderMenu, relation, SlabSection, Tags, tokens } from '../../components/index'
import { useGo } from '../../components/shared/useGo'

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

/** Up to this many head chips (an Assign and a Create per slot) stand alone. */
const MAX_CHIPS = 3

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
  const go = useGo()
  if (!hasAssignedUnits(units, editable)) return null
  const open = editable ? slots : []
  // Each Assign is its own chip (it opens its pick dialog); a Create is a link
  // to that kind's builder, and past MAX_CHIPS the Creates share one ⋯ menu.
  const creates =
    open.length * 2 > MAX_CHIPS ? (
      <HeaderMenu
        variant="overflow"
        size="compact"
        label="Create a unit"
        trigger={null}
        sections={[
          open.map((slot) => ({
            id: slot.key,
            label: `+ Create ${KIND_NAME[slot.kind]}`,
            onSelect: () => go(NEW_PATH[slot.kind]),
          })),
        ]}
      />
    ) : (
      open.map((slot) => (
        <Button key={slot.key} href={NEW_PATH[slot.kind]} size="compact">
          + Create {KIND_NAME[slot.kind]}
        </Button>
      ))
    )
  return (
    <SlabSection
      fold="open"
      id="linked-units"
      title="Assigned units"
      bodyClassName="su-sheet-linked"
      actions={
        open.length > 0 ? (
          <>
            {open.map((slot) => (
              <Fragment key={slot.key}>{slot.assign}</Fragment>
            ))}
            {creates}
          </>
        ) : undefined
      }
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
      {/* What stands in stays in the body: a stepper is not a button's Size (C1a). */}
      {open.map((slot) => slot.extra && <Fragment key={slot.key}>{slot.extra}</Fragment>)}
    </SlabSection>
  )
}
