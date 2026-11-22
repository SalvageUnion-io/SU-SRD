/**
 * A pattern Page's loadout at a glance: one Ledger, a line the chassis and a
 * line each System and Module (copies counted), their slots and Scrap in
 * columns, and the sums on the last line: slots filled of the chassis's and
 * what the build costs. The parts in full follow it on the Page. A saved
 * pattern's page shows the same Ledger (`PublicPattern`), where a count over
 * its chassis wears the rule-breaking mark.
 */

import type { RefChassis, RefEntity } from 'salvageunion-reference'
import { nameToSlug, SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { computeMechCapacity } from 'salvageunion-reference/rules'
import { RuleBreakMark } from '../components/app'
import type { LedgerColumn, LedgerRow } from '../components/index'
import { Ledger } from '../components/index'
import { mechScrap } from '../lib/rules/mechScrap'
import { pagesCopy } from '../messages/reference-pages'

type PatternPart = { name: string; count?: number | undefined }
type MechPatternLike = {
  name: string
  systems: readonly PatternPart[]
  modules: readonly PatternPart[]
}

const COLUMNS: LedgerColumn[] = [
  {
    key: 'sys',
    label: pagesCopy('sys'),
    title: pagesCopy('systemSlots'),
    kind: 'figure',
    phone: true,
  },
  {
    key: 'mod',
    label: pagesCopy('mod'),
    title: pagesCopy('moduleSlots'),
    kind: 'figure',
    phone: true,
  },
  {
    key: 'scrap',
    label: pagesCopy('scrap'),
    title: pagesCopy('salvageValue'),
    kind: 'figure',
    phone: true,
  },
]

const copies = (parts: readonly PatternPart[]) =>
  parts.flatMap((part) => new Array<string>(part.count ?? 1).fill(nameToSlug(part.name)))

function partRow(
  part: PatternPart,
  entity: (RefEntity & { slotsRequired?: number; salvageValue?: number }) | undefined,
  column: 'sys' | 'mod'
): LedgerRow {
  const count = part.count ?? 1
  const slots = entity?.slotsRequired === undefined ? '' : entity.slotsRequired * count
  const scrap = entity?.salvageValue === undefined ? '' : entity.salvageValue * count
  return {
    id: `${column}-${part.name}`,
    name: count > 1 ? `${part.name} ×${count}` : part.name,
    entityRef: entity ? toEntityModel(entity).ref : undefined,
    cells: [column === 'sys' ? slots : '', column === 'mod' ? slots : '', scrap],
  }
}

export function PatternLoadout({
  chassis,
  pattern,
}: {
  chassis: RefChassis
  pattern: MechPatternLike
}) {
  const build = {
    chassisRef: nameToSlug(chassis.name),
    systems: copies(pattern.systems),
    modules: copies(pattern.modules),
  }
  const capacity = computeMechCapacity({
    chassisRef: build.chassisRef,
    systems: build.systems.map((ref) => ({ ref })),
    modules: build.modules.map((ref) => ({ ref })),
  })
  // A count over its chassis wears the one mark (R71); a loadout the book prints over wears none.
  const slots = (used: number, max: number) =>
    !capacity.asPrinted && used > max ? (
      // On a phone the mark sits under the figure (`.su-ledger__over`), so Scrap stays on screen.
      <span className="su-ledger__over">
        {used}/{max} <RuleBreakMark />
      </span>
    ) : (
      `${used}/${max}`
    )
  const rows: LedgerRow[] = [
    {
      id: 'chassis',
      name: chassis.name,
      entityRef: toEntityModel(chassis).ref,
      cells: ['', '', chassis.salvageValue],
    },
    ...pattern.systems.map((part) =>
      partRow(part, SalvageUnionReference.Systems.getByName(part.name), 'sys')
    ),
    ...pattern.modules.map((part) =>
      partRow(part, SalvageUnionReference.Modules.getByName(part.name), 'mod')
    ),
  ]
  return (
    <Ledger
      label={pagesCopy('loadoutOf', { name: pattern.name })}
      tone="mech"
      nameLabel={pagesCopy('loadout')}
      columns={COLUMNS}
      rows={rows}
      total={{
        // A printed total over its limit is the book's own, and says so.
        label:
          capacity.asPrinted &&
          (capacity.systemSlotsUsed > capacity.systemSlotsMax ||
            capacity.moduleSlotsUsed > capacity.moduleSlotsMax)
            ? pagesCopy('totalAsPrinted')
            : pagesCopy('total'),
        cells: [
          slots(capacity.systemSlotsUsed, capacity.systemSlotsMax),
          slots(capacity.moduleSlotsUsed, capacity.moduleSlotsMax),
          mechScrap(build).total,
        ],
      }}
    />
  )
}
