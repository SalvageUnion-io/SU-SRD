/**
 * AssignedUnits — a sheet's Assigned units section: each linked unit is a
 * contentful Mini of its kind in one masonry grid (`MiniGrid`), never a chip
 * (R5). Its name opens that unit's sheet
 * and Peeks nothing; its body is its status, its vitals as they stand (`SP |
 * 9/13`). Edit puts the link's controls in its chip group (C8: Change,
 * Unassign). In Edit each place still to fill is a placeholder Mini of its
 * kind ("No Mech assigned") with the ways to fill it, Assign and + Create,
 * as its controls. Read leaves the section out when nothing is linked
 * (`hasAssignedUnits`).
 *
 * The one section every kind draws, pilot, mech and crawler, with its one
 * body class (`.su-sheet-linked`); what it lists is `assignedUnitsFor`. It
 * sits in the sheet's sidebar, which never folds (R11), so it has no fold.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import { Unlink } from 'lucide-react'
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
import { unitRowModel } from '../../lib/units/unitModel'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { AssignedSlot, AssignedUnit } from './assignedUnits.model'
import { hasAssignedUnits } from './assignedUnits.model'

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
      id="linked-units"
      title={buildSheetCopy('assignedUnits')}
      bodyClassName="su-sheet-linked"
    >
      {units.length > 0 && (
        <MiniGrid label={buildSheetCopy('assignedUnits')} edit={editable}>
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
                              aria-label={buildSheetCopy('unassign2', { name: unit.name })}
                              onClick={unit.onUnassign}
                              glyph={<Unlink size={tokens.iconSize.mini} aria-hidden="true" />}
                            >
                              {buildSheetCopy('unassign')}
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
          button's Size, C1a) its body. */}
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
                  {buildSheetCopy('create')}
                </Button>
              </>
            }
          />
        </Fragment>
      ))}
    </SlabSection>
  )
}
