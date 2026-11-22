/**
 * The Related units every live sheet draws (`RelatedUnits`), built once for
 * pilot, mech and crawler alike — pure, no JSX: the pickers come from the
 * caller's `picker`.
 *
 * Each kind has two places to fill, one per kind it links to (ADR-037):
 *
 *   pilot    mech (one), crawler (one)
 *   mech     pilot (one), crawler (one)
 *   crawler  mech (many: its bay), pilot (many: its crew)
 *
 * After them its companions (a pilot's ability-granted partners, a mech's
 * chassis partners), each linking to its own sheet; they are granted, never
 * assigned, so they have no place to fill.
 *
 * A place holds its linked units, each a Mini with its Tech Level (a mech's
 * or crawler's) and its vitals as they stand,
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

import { containerOf } from 'game-domain/container'
import type { SheetKind } from 'game-domain/entityKinds'
import { sheetPath } from 'game-domain/entityKinds'
import { mechHasCondition } from 'game-domain/rules/crewStatus'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { EntityRef } from 'game-domain/schemas/entity'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { SoftLink } from 'game-domain/schemas/softLink'
import type { ReactNode } from 'react'
import { resolveGauge, resolvePool } from 'salvageunion-reference/rules'
import {
  partnerDerivedStats,
  partnerTechLevel,
  resolvePartnerStatBlock,
} from '../../lib/rules/partnerStats'
import { chassisTechLevel, techLevelReading } from '../../lib/units/readings'
import type { UnitReading } from '../../lib/units/unitModel'
import { newInGameHref } from '../../lib/wizard/fromGame'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { PickerControl } from '../wiring/AssignPicker'
import type { SheetComposition } from './composition.model'
import { partnerDisplayName } from './partnerDisplay.model'
import { crawlerRailItems, mechRailItems, pilotRailItems, rowStats } from './railStats.model'
import type { WithheldUnit } from './sheetViewProps.model'
import { SHEET_VITALS } from './sheetVitals.model'
import type { OwnerOf } from './unitOwners.model'

/** One linked unit: what it is to this sheet, its name, and where its sheet is. */
export type AssignedUnit = {
  key: string
  /** The unit's kind: its Mini's tone. A companion is its host's partner. */
  kind: SheetKind | 'companion'
  /** What it is built as ("Engineer", "Scrapper"), stamped by its name. */
  note?: string | undefined
  /** Its status, its vitals as they stand (`SP | 9/13`): its Mini's body. */
  readings?: readonly UnitReading[]
  /** Its name; a withheld unit on a public sheet says "Not shared". */
  name: string
  /** Its sheet; without one the chip opens nothing (a withheld unit). */
  href?: string | undefined
  /** Who holds it in the Game (MINE, a crewmate, UNASSIGNED): a chip on its head. */
  owner?: string | undefined
  /** On a crawler in Read, the mech this pilot flies: a MECH chip on their Mini. */
  flies?: string | undefined
  /** Edit: Change, the picker that replaces it, opened from the unit's ⋯ (R62). */
  change?: (control: PickerControl) => ReactNode
  /** Edit: take the link off (never the unit). */
  onUnassign?: (() => void) | undefined
}

/** How a kind's place is filled, when it is empty or takes more than one. */
export type AssignedSlot = {
  key: string
  kind: SheetKind
  /** A place of many (a crawler's bay or crew), and whether it holds any yet. */
  many?: { filled: boolean }
  /** Assign one that exists (`AssignPicker`). */
  assign: ReactNode
  /**
   * + Create's wizard: in the sheet's own Game when it is in one, so the new
   * unit can be assigned here (a link never crosses containers); else the Hangar.
   */
  createHref: string
  /** What stands in while it is empty (a pilot's mock crawler level): its placeholder's body. */
  extra?: ReactNode
  /** The placeholder's name for a writer (a place of many's "Dock a Mech"); `No <kind>` by default. */
  placeholder?: string
  /** + Create's words where they are not "+ Create" (a lost Mech's "Build a new Mech"). */
  createLabel?: string
  /** Drawn for a writer only: a reader sees the unit itself, not a place to fill. */
  writerOnly?: true
}

const NEW_PATH = {
  pilot: '/pilots/new',
  mech: '/mechs/new',
  crawler: '/crawlers/new',
} as const satisfies Record<SheetKind, string>

/**
 * The wizard that makes a `kind` in the subject's container (ADR-052 §3). A
 * pilot's mech is made for that pilot (`?pilot=`, as the Training Bay's
 * "+ Add a Mech" is) and a mech's pilot for that mech (`?mech=`): the wizard
 * assigns the pair and comes back here. A crawler names the pilot or mech it
 * was made from the same way, and takes that unit and its pair (r4 E19).
 */
function createHrefFor(kind: SheetKind, subject: AssignedSubject): string {
  const container = containerOf(subject.entity)
  const href =
    container.kind === 'game' ? newInGameHref(NEW_PATH[kind], container.gameId) : NEW_PATH[kind]
  const pair =
    subject.kind === 'pilot' && kind !== 'pilot'
      ? 'pilot'
      : subject.kind === 'mech' && kind !== 'mech'
        ? 'mech'
        : null
  if (pair === null) return href
  return `${href}${href.includes('?') ? '&' : '?'}${pair}=${encodeURIComponent(subject.entity.id)}`
}

/** The sheet's own entity, by its kind. */
export type AssignedSubject =
  | { kind: 'pilot'; entity: Pilot }
  | { kind: 'mech'; entity: Mech }
  | { kind: 'crawler'; entity: Crawler }

/** The assign picker for one place: `AssignPicker` with this sheet as its subject. */
export type PlacePicker = (
  pick: SheetKind,
  options: {
    filled?: true
    exclude?: readonly string[]
    size?: 'mini'
    /** Opened from the unit Mini's ⋯ (R62) rather than a trigger of its own. */
    control?: PickerControl
  }
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
  mech: buildSheetCopy('dockAMech'),
  pilot: buildSheetCopy('addAPilotToTheCrew'),
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
 * A unit's Tech Level (a mech's chassis's, a crawler's own), then its vitals
 * as they stand, as its own sheet reads them: a mech with its
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
    return [
      ...techLevelReading(chassisTechLevel(mech.chassisRef)),
      ...rowStats(mechRailItems(mech, pilot?.abilities)),
    ]
  }
  if (kind === 'pilot') {
    const pilot = entity as Pilot
    const crawler = subject.kind === 'crawler' ? subject.entity : composition.crawler
    return rowStats(pilotRailItems(pilot, crawler))
  }
  const crawler = entity as Crawler
  return [...techLevelReading(crawler.techLevel), ...rowStats(crawlerRailItems(crawler))]
}

/**
 * The host's companions, each linking to its own sheet
 * (`/pilots/:id/companions/:partnerId`, a mech's likewise) where the host's
 * own sheet is an app sheet; elsewhere (a public or Starter Set sheet) a
 * companion opens nothing.
 */
function companionsOf(
  subject: AssignedSubject,
  hrefFor: (kind: EntityRef['type'], id: string) => string | undefined
): AssignedUnit[] {
  if (subject.kind === 'crawler') return []
  const host = subject.entity
  const hostHref = hrefFor(subject.kind, host.id)
  const linkable = hostHref === sheetPath(subject.kind, host.id)
  return (host.partners ?? []).map((partner) => {
    const block = resolvePartnerStatBlock(partner) as { name?: string } | null
    const max = partnerDerivedStats(partner, partnerTechLevel(partner, undefined))
    const name = partnerDisplayName(partner)
    return {
      key: `companion-${partner.id}`,
      kind: 'companion' as const,
      name,
      note: block?.name && block.name !== name ? block.name : undefined,
      readings: [
        {
          label: SHEET_VITALS.sp.short,
          value: `${resolvePool(partner.currentSP, max.structurePoints)}/${max.structurePoints}`,
        },
        {
          label: SHEET_VITALS.ep.short,
          value: `${resolvePool(partner.currentEP, max.energyPoints)}/${max.energyPoints}`,
        },
        {
          label: SHEET_VITALS.heat.short,
          value: `${resolveGauge(partner.currentHeat)}/${max.heatCapacity}`,
        },
      ],
      href: linkable ? `${hostHref}/companions/${encodeURIComponent(partner.id)}` : undefined,
    }
  })
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

/**
 * A crawler's crew as pairs: each pilot with the mech they fly in this bay
 * (`flies`), that mech no unit of its own; pilots first, then the mechs
 * nobody here flies.
 */
function crewPairs(units: readonly AssignedUnit[], composition: SheetComposition): AssignedUnit[] {
  const crew = new Set(composition.crawlerPilots.map((pilot) => pilot.id))
  const flownBy = new Map<string, string>()
  for (const [mechId, pilot] of Object.entries(composition.crawlerMechPilots)) {
    if (crew.has(pilot.id)) flownBy.set(mechId, pilot.id)
  }
  const flies = new Map(
    composition.crawlerMechs
      .filter((mech) => flownBy.has(mech.id))
      .map((mech) => [flownBy.get(mech.id) as string, mech.name] as const)
  )
  const pilots = units
    .filter((unit) => unit.kind === 'pilot')
    .map((unit) => (flies.has(unit.key) ? { ...unit, flies: flies.get(unit.key) } : unit))
  const rest = units.filter((unit) => unit.kind !== 'pilot' && !flownBy.has(unit.key))
  return [...pilots, ...rest]
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
        ...(place.many
          ? {}
          : {
              change: (control: PickerControl) =>
                picker(kind, { filled: true, exclude: [entity.id], control }),
            }),
        onUnassign: unassignable ? () => args.unassign(link.id) : undefined,
      })
    }
    // A pilot whose Mech is Destroyed is offered its replacement where the Mech
    // stands: built for the pilot, in their Game, and assigned (r5 B17).
    const lost = subject.kind === 'pilot' && kind === 'mech' ? place.linked[0] : undefined
    if (lost !== undefined && mechHasCondition(lost as Mech, 'Destroyed')) {
      slots.push({
        key: 'mech-lost',
        kind,
        assign: picker(kind, { filled: true, exclude: [lost.id], size: 'mini' }),
        createHref: createHrefFor(kind, subject),
        placeholder: buildSheetCopy('noWorkingMech'),
        createLabel: buildSheetCopy('buildANewMech'),
        writerOnly: true,
      })
    }
    const hidden = withheld.filter((unit) => unit.kind === kind)
    const named = place.many ? hidden : place.linked.length > 0 ? [] : hidden.slice(0, 1)
    for (const unit of named) {
      units.push({
        key: place.many ? unit.key : kind,
        kind,
        name: unit.name ?? buildSheetCopy('notShared'),
      })
    }
    if (place.many) {
      slots.push({
        key: kind,
        kind,
        many: { filled: place.linked.length + named.length > 0 },
        assign: picker(kind, { exclude: place.linked.map((e) => e.id), size: 'mini' }),
        createHref: createHrefFor(kind, subject),
        ...(place.placeholder ? { placeholder: place.placeholder } : {}),
      })
    } else if (place.linked.length === 0 && named.length === 0) {
      const extra = args.extra?.[kind]
      slots.push({
        key: kind,
        kind,
        assign: picker(kind, { size: 'mini' }),
        createHref: createHrefFor(kind, subject),
        ...(extra ? { extra } : {}),
      })
    }
  }
  units.push(...companionsOf(subject, args.hrefFor))
  // In Read, a crawler's crew reads as pairs: the pilot first, and the mech
  // they fly a MECH chip on their Mini, not a Mini of its own.
  if (subject.kind === 'crawler' && !editable)
    return { units: crewPairs(units, composition), slots }
  return { units, slots }
}
