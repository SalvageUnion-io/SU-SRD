/**
 * RelatedUnits — a sheet's Related units section (R70): its crew, mech,
 * crawler and companions, each a contentful Mini of its kind in one masonry
 * grid (`MiniGrid`), never a chip (C11). Its name opens that unit's sheet (a
 * companion's own page) and Peeks nothing; its body is its status, its vitals
 * as they stand (`SP | 9/13`). Edit puts the link's acts, Change and
 * Unassign, in its ⋯ (R62).
 *
 * It draws in Read as in Edit, empty or not: each place still to fill is a
 * placeholder Mini of its kind ("No mech"), with the ways to fill it, Assign
 * and + Create, as its controls wherever the viewer may write the sheet
 * (`writes`); plain otherwise.
 *
 * The one section every kind draws, pilot, mech and crawler, with its one
 * body class (`.su-sheet-linked`); what it lists is `assignedUnitsFor`. It
 * has no fold.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import { Fragment, useState } from 'react'
import { Cluster } from '../../components/app'
import {
  Button,
  Entity,
  HeaderMenu,
  MiniGrid,
  relation,
  SlabSection,
  Stat,
} from '../../components/index'
import { unitRowModel } from '../../lib/units/unitModel'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { AssignedSlot, AssignedUnit } from './assignedUnits.model'

const KIND_NAME: Record<SheetKind, string> = {
  pilot: 'Pilot',
  mech: 'Mech',
  crawler: 'Crawler',
}

/** A place's empty name: "No mech", "No pilot" (each key a literal, for the catalogue). */
const noneOf = (kind: SheetKind): string =>
  kind === 'pilot'
    ? buildSheetCopy('noPilot')
    : kind === 'mech'
      ? buildSheetCopy('noMech')
      : buildSheetCopy('noCrawler')

export function RelatedUnits({
  units,
  slots = [],
  editable,
  writes = editable,
}: {
  units: readonly AssignedUnit[]
  slots?: readonly AssignedSlot[]
  editable: boolean
  /** The viewer may write the sheet, in Read as in Edit: each empty place offers Assign and + Create. */
  writes?: boolean
}) {
  // The unit whose Change picker its ⋯ opened.
  const [changing, setChanging] = useState<string | null>(null)
  // A place of many (a crawler's bay) that holds some reads by its units alone
  // to a viewer who cannot add one.
  const open = slots.filter((slot) => writes || (!slot.many?.filled && !slot.writerOnly))
  return (
    <SlabSection
      id="linked-units"
      title={buildSheetCopy('relatedUnits')}
      bodyClassName="su-sheet-linked"
    >
      {units.length > 0 && (
        <MiniGrid label={buildSheetCopy('relatedUnits')} edit={editable}>
          {units.map((unit) => (
            <li key={unit.key} data-assigned-unit="" data-related-kind={unit.kind}>
              <Entity
                size="mini"
                context="roster"
                model={unitRowModel({
                  // A companion wears a mech's tone: SP, EP and Heat, as a mech's.
                  kind: unit.kind === 'companion' ? 'mech' : unit.kind,
                  name: unit.name,
                  note:
                    unit.kind === 'companion'
                      ? (unit.note ?? buildSheetCopy('companion'))
                      : unit.note,
                })}
                {...(unit.href ? { mode: { kind: 'link' as const, href: unit.href } } : {})}
                {...(unit.owner ? { state: <Stat label={unit.owner} size="mini" /> } : {})}
                {...(unit.flies
                  ? { relations: [relation(`flies-${unit.key}`, 'Mech', unit.flies)] }
                  : {})}
                body={{
                  text: false,
                  children: unit.readings?.length ? (
                    <Cluster gap={4}>
                      {unit.readings.map((reading) => (
                        <Stat
                          key={String(reading.label)}
                          label={reading.label}
                          value={reading.value}
                          size="mini"
                        />
                      ))}
                    </Cluster>
                  ) : undefined,
                }}
                {...(editable && unit.kind !== 'companion' && (unit.change || unit.onUnassign)
                  ? {
                      // R62: a unit's acts ride its ⋯, so its head stays one line (C2b).
                      controls: (
                        <HeaderMenu
                          variant="overflow"
                          trigger={null}
                          label={buildSheetCopy('unitActions', { name: unit.name })}
                          sections={[
                            [
                              ...(unit.change
                                ? [
                                    {
                                      id: 'change',
                                      label: buildSheetCopy('changeKind', {
                                        kind: KIND_NAME[unit.kind as SheetKind],
                                      }),
                                      onSelect: () => setChanging(unit.key),
                                    },
                                  ]
                                : []),
                              ...(unit.onUnassign
                                ? [
                                    {
                                      id: 'unassign',
                                      label: buildSheetCopy('unassign'),
                                      onSelect: unit.onUnassign,
                                    },
                                  ]
                                : []),
                            ],
                          ]}
                        />
                      ),
                    }
                  : {})}
              />
              {editable &&
                unit.change?.({ open: changing === unit.key, onClose: () => setChanging(null) })}
            </li>
          ))}
        </MiniGrid>
      )}
      {/* Each place to fill, a placeholder of its kind: for a writer with
          Assign and + Create inside it, and in Edit what stands in for it (a
          stepper is not a button's Size, C1a) its body. */}
      {open.map((slot) => (
        <Fragment key={slot.key}>
          <Entity
            size="mini"
            context="roster"
            model={unitRowModel({
              kind: slot.kind,
              name: writes && slot.placeholder ? slot.placeholder : noneOf(slot.kind),
            })}
            {...(editable && slot.extra ? { body: { text: false, children: slot.extra } } : {})}
            {...(writes
              ? {
                  controls: (
                    <>
                      {slot.assign}
                      <Button href={slot.createHref} size="mini">
                        {slot.createLabel ?? buildSheetCopy('create')}
                      </Button>
                    </>
                  ),
                }
              : {})}
          />
        </Fragment>
      ))}
    </SlabSection>
  )
}
