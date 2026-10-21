/**
 * AssignedUnits — a sheet's Assigned units section: each linked unit is a
 * contentful Mini of its kind in one masonry grid (`MiniGrid`), never a chip
 * (owner, 2026-10-20: "a masonry grid of contentful tokens, containing
 * relative status ... never be chips. References to other units should
 * always be compact or mini references"). Its name opens that unit's sheet
 * and Peeks nothing; its body is its status, its vitals as they stand (`SP |
 * 9/13`). Edit puts the link's controls in its chip group (C8: Change,
 * Unassign). In Edit each place still to fill is a placeholder Mini of its
 * kind ("No Mech assigned") with the ways to fill it, Assign and + Create,
 * as its controls. Read leaves the section out when nothing is linked
 * (`hasAssignedUnits`).
 *
 * The one section every kind draws, pilot, mech and crawler, with its one
 * body class (`.su-sheet-linked`).
 */

import type { SheetKind } from 'game-domain/entityKinds'
import { Unlink } from 'lucide-react'
import type { ReactNode } from 'react'
import { Fragment } from 'react'
import {
  Button,
  Cluster,
  Entity,
  MiniGrid,
  SlabSection,
  Stat,
  tokens,
} from '../../components/index'
import type { UnitReading } from '../../lib/units/unitModel'
import { unitRowModel } from '../../lib/units/unitModel'

/** One linked unit: what it is to this sheet, its name, and where its sheet is. */
export type AssignedUnit = {
  key: string
  /** The unit's kind: its Mini's tone. */
  kind: SheetKind
  /** What it is built as ("Engineer", "Scrapper"), stamped by its name. */
  note?: string | undefined
  /** Its status, its vitals as they stand (`SP | 9/13`): its Mini's body. */
  readings?: readonly UnitReading[]
  /** Its name; a withheld unit on a public sheet says "Not shared". */
  name: string
  /** Its sheet; without one the chip opens nothing (a withheld unit). */
  href?: string
  /** Who holds it in the Game (YOU, a crewmate, UNCLAIMED): a chip on its head (owner, round 7). */
  owner?: string | undefined
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
  /** What stands in while it is empty (a pilot's mock crawler level): its placeholder's body. */
  extra?: ReactNode
  /** The placeholder's name; `No <Kind> assigned` by default. */
  placeholder?: string
}

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
      {units.length > 0 && (
        <MiniGrid label="Assigned units" edit={editable}>
          {units.map((unit) => (
            <li key={unit.key} data-assigned-unit="">
              <Entity
                size="mini"
                context="roster"
                model={unitRowModel({ kind: unit.kind, name: unit.name, note: unit.note })}
                {...(unit.href ? { mode: { kind: 'link' as const, href: unit.href } } : {})}
                {...(unit.owner ? { state: <Stat label={unit.owner} size="mini" /> } : {})}
                body={{
                  text: false,
                  children: unit.readings?.length ? (
                    <Cluster gap={4}>
                      {unit.readings.map((reading) => (
                        <Stat
                          key={String(reading.label)}
                          label={reading.label}
                          value={reading.value}
                          size="compact"
                        />
                      ))}
                    </Cluster>
                  ) : undefined,
                }}
                {...(editable && (unit.change || unit.onUnassign)
                  ? {
                      controls: (
                        <>
                          {unit.change}
                          {unit.onUnassign && (
                            <Button
                              variant="ghost"
                              size="mini"
                              aria-label={`Unassign ${unit.name}`}
                              onClick={unit.onUnassign}
                              glyph={<Unlink size={tokens.iconSize.mini} aria-hidden="true" />}
                            >
                              Unassign
                            </Button>
                          )}
                        </>
                      ),
                    }
                  : {})}
              />
            </li>
          ))}
        </MiniGrid>
      )}
      {/* Each place to fill, a placeholder of its kind with Assign and
          + Create inside it; what stands in for it (a stepper is not a
          button's Size, C1a) its body (owner, round 5). */}
      {open.map((slot) => (
        <Fragment key={slot.key}>
          <Entity
            size="mini"
            context="roster"
            model={unitRowModel({
              kind: slot.kind,
              name: slot.placeholder ?? `No ${KIND_NAME[slot.kind]} assigned`,
            })}
            {...(slot.extra ? { body: { text: false, children: slot.extra } } : {})}
            controls={
              <>
                {slot.assign}
                <Button href={NEW_PATH[slot.kind]} size="mini">
                  + Create
                </Button>
              </>
            }
          />
        </Fragment>
      ))}
    </SlabSection>
  )
}
