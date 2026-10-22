/**
 * The Assigned units every live sheet draws (`AssignedUnits`), built once for
 * pilot, mech and crawler alike — pure, no JSX: the pickers come from the
 * caller's `picker`.
 *
 * Each kind has two places to fill, one per kind it links to (ADR-037):
 *
 *   pilot    mech (one), crawler (one)
 *   mech     pilot (one), crawler (one)
 *   crawler  mech (many: its bay), pilot (many: its crew)
 *
 * A place holds its linked units, each a Mini with its vitals as they stand,
 * the owner chip of whoever holds it in the Game (`ownerOf`), its Change
 * picker (a place of one) and its Unassign; else the units a public sheet may
 * name but not read ("Not shared"); else, in Edit, its Assign. A place of many
 * keeps its Assign after the first.
 *
 * Unassign takes the link off, never the unit, with no confirm: an assignment
 * is reversible bookkeeping (ADR-007). A link is undrawn from its `from` end,
 * so only one this sheet holds (`holds`) offers it: a crewmate's mech flying
 * this pilot is theirs to unassign.
 */

import { resolveEffectiveCrawlerLevel } from 'game-domain/crawlerLevel'
import type { SheetKind } from 'game-domain/entityKinds'
import { pilotingContext } from 'game-domain/rules/pilotingContext'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { EntityRef } from 'game-domain/schemas/entity'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { SoftLink } from 'game-domain/schemas/softLink'
import type { ReactNode } from 'react'
import type { UnitReading } from '../../lib/units/unitModel'
import type { SheetComposition } from './composition.model'
import { crawlerRailItems, mechRailItems, pilotRailItems, rowStats } from './railStats.model'
import type { WithheldUnit } from './sheetViewProps.model'
import type { OwnerOf } from './unitOwners.model'

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
  href?: string | undefined
  /** Who holds it in the Game (YOU, a crewmate, UNASSIGNED): a chip on its head. */
  owner?: string | undefined
  /** Edit: Change, the picker that replaces it (before Unassign). */
  change?: ReactNode
  /** Edit: take the link off (never the unit). */
  onUnassign?: (() => void) | undefined
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

/** Whether the section draws at all: Read leaves it out with nothing linked. */
export function hasAssignedUnits(units: readonly AssignedUnit[], editable: boolean): boolean {
  return editable || units.length > 0
}

/** The sheet's own entity, by its kind. */
export type AssignedSubject =
  | { kind: 'pilot'; entity: Pilot }
  | { kind: 'mech'; entity: Mech }
  | { kind: 'crawler'; entity: Crawler }

/** The assign picker for one place: `AssignPicker` with this sheet as its subject. */
export type PlacePicker = (
  pick: SheetKind,
  options: { filled?: true; exclude?: readonly string[]; size?: 'mini' }
) => ReactNode

type LinkedEntity = Pilot | Mech | Crawler

/** One place to fill: the kind it takes, what fills it, and whether it takes more than one. */
type Place = {
  kind: SheetKind
  linked: readonly LinkedEntity[]
  many: boolean
  placeholder?: string
}

/** A place of many is named for what it adds. */
const MANY_PLACEHOLDER: Partial<Record<SheetKind, string>> = {
  mech: 'Dock a Mech',
  pilot: 'Add a Pilot to the crew',
}

function placesOf(subject: AssignedSubject, composition: SheetComposition): Place[] {
  const one = (kind: SheetKind, entity: LinkedEntity | null): Place => ({
    kind,
    linked: entity ? [entity] : [],
    many: false,
  })
  const many = (kind: SheetKind, linked: readonly LinkedEntity[]): Place => ({
    kind,
    linked,
    many: true,
    placeholder: MANY_PLACEHOLDER[kind],
  })
  // A crawler's bay before its crew; each place's units before its Assign.
  switch (subject.kind) {
    case 'pilot':
      return [one('mech', composition.mech), one('crawler', composition.crawler)]
    case 'mech':
      return [one('pilot', composition.pilot), one('crawler', composition.crawler)]
    case 'crawler':
      return [many('mech', composition.crawlerMechs), many('pilot', composition.crawlerPilots)]
  }
}

/**
 * A unit's vitals as they stand, as its own sheet reads them: a mech with its
 * pilot's piloting context (Beefcake raises its Max SP, ADR-029), a pilot
 * with its effective crawler tier (Stat Training).
 */
function readingsOf(
  kind: SheetKind,
  entity: LinkedEntity,
  subject: AssignedSubject,
  composition: SheetComposition
): UnitReading[] {
  if (kind === 'mech') {
    const mech = entity as Mech
    const pilot = subject.kind === 'pilot' ? subject.entity : composition.crawlerMechPilots[mech.id]
    return rowStats(mechRailItems(mech, pilotingContext(mech, pilot?.abilities)))
  }
  if (kind === 'pilot') {
    const pilot = entity as Pilot
    const crawler = subject.kind === 'crawler' ? subject.entity : composition.crawler
    return rowStats(pilotRailItems(pilot, resolveEffectiveCrawlerLevel(pilot, crawler)))
  }
  return rowStats(crawlerRailItems(entity as Crawler))
}

/** The link between the sheet's entity and one unit, whichever way it points. */
function linkBetween(
  softLinks: readonly SoftLink[],
  self: { type: SheetKind; id: string },
  unit: { type: SheetKind; id: string }
): SoftLink | undefined {
  const is = (end: SoftLink['from'], ref: { type: SheetKind; id: string }) =>
    end.type === ref.type && end.id === ref.id
  return softLinks.find(
    (l) => (is(l.from, self) && is(l.to, unit)) || (is(l.from, unit) && is(l.to, self))
  )
}

export function assignedUnitsFor(args: {
  subject: AssignedSubject
  composition: SheetComposition
  withheld: readonly WithheldUnit[]
  softLinks: readonly SoftLink[]
  holds: (kind: EntityRef['type'], id: string) => boolean
  hrefFor: (kind: EntityRef['type'], id: string) => string | undefined
  ownerOf?: OwnerOf | undefined
  editable: boolean
  /** Take one link off (the caller's store write). */
  unassign: (linkId: string) => void
  picker: PlacePicker
  /** What stands in for an empty place of one kind (a pilot's mock crawler level). */
  extra?: Partial<Record<SheetKind, ReactNode>>
}): { units: AssignedUnit[]; slots: AssignedSlot[] } {
  const { subject, composition, withheld, softLinks, holds, editable, picker } = args
  const self = { type: subject.kind, id: subject.entity.id }
  const units: AssignedUnit[] = []
  const slots: AssignedSlot[] = []

  for (const place of placesOf(subject, composition)) {
    const { kind } = place
    for (const entity of place.linked) {
      const link = linkBetween(softLinks, self, { type: kind, id: entity.id })
      const unassignable = editable && link && holds(link.from.type, link.from.id)
      units.push({
        key: place.many ? entity.id : kind,
        kind,
        name: entity.name,
        readings: readingsOf(kind, entity, subject, composition),
        href: args.hrefFor(kind, entity.id),
        owner: args.ownerOf?.(kind, entity.id)?.label,
        ...(place.many ? {} : { change: picker(kind, { filled: true, exclude: [entity.id] }) }),
        onUnassign: unassignable ? () => args.unassign(link.id) : undefined,
      })
    }
    const hidden = withheld.filter((unit) => unit.kind === kind)
    const named = place.many ? hidden : place.linked.length > 0 ? [] : hidden.slice(0, 1)
    for (const unit of named) {
      units.push({ key: place.many ? unit.key : kind, kind, name: unit.name ?? 'Not shared' })
    }
    if (place.many) {
      slots.push({
        key: kind,
        kind,
        assign: picker(kind, { exclude: place.linked.map((e) => e.id), size: 'mini' }),
        ...(place.placeholder ? { placeholder: place.placeholder } : {}),
      })
    } else if (place.linked.length === 0 && named.length === 0) {
      const extra = args.extra?.[kind]
      slots.push({
        key: kind,
        kind,
        assign: picker(kind, { size: 'mini' }),
        ...(extra ? { extra } : {}),
      })
    }
  }
  return { units, slots }
}
