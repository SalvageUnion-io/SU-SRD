/**
 * The Training Bay shelves' columns and cells, in the Ledger form: a shelf's
 * columns in the one order (ruleset §2.6), and what a cell reads from a unit.
 */
import type { ReactNode } from 'react'
import type { LedgerColumn } from '../../components/index'
import { VITAL } from '../../lib/units/readings'
import type { UnitReading } from '../../lib/units/unitModel'
import { buildShelvesCopy } from '../../messages/build-shelves'
import { ShelfLink } from './ShelfLedger'

/** The crawler's bays reading, by its label on the rail. */
export const BAYS = 'Bays'

const fig = (key: string, title: string, phone = false): LedgerColumn => ({
  key,
  label: key,
  title,
  kind: 'figure',
  phone,
})
const word = (key: string, label: string, phone = false): LedgerColumn => ({
  key,
  label,
  kind: 'text',
  phone,
})
const GAME = word('game', buildShelvesCopy('game'))
// The one column order (ruleset §2.6): the words that place a row (its class,
// its crew, its Game) follow its name, then its figures in the stat order.
export const PILOT_COLUMNS = [
  word('class', buildShelvesCopy('class'), true),
  word('mech', buildShelvesCopy('mech')),
  GAME,
  fig(VITAL.hp, buildShelvesCopy('hitPoints'), true),
  fig(VITAL.ap, buildShelvesCopy('abilityPoints')),
]
export const MECH_COLUMNS = [
  word('chassis', buildShelvesCopy('chassis'), true),
  word('pilot', buildShelvesCopy('pilot')),
  GAME,
  fig(VITAL.sp, buildShelvesCopy('structurePoints'), true),
  fig(VITAL.ep, buildShelvesCopy('energyPoints')),
  fig(VITAL.heat, buildShelvesCopy('heat')),
]
export const CRAWLER_COLUMNS = [
  word('type', buildShelvesCopy('type'), true),
  GAME,
  fig(buildShelvesCopy('tl'), buildShelvesCopy('techLevel')),
  fig(VITAL.sp, buildShelvesCopy('structurePoints')),
  fig(BAYS, buildShelvesCopy('baysIntact')),
]
export const NPC_COLUMNS = [
  word('position', buildShelvesCopy('position')),
  word('who', buildShelvesCopy('seenBy')),
  GAME,
  fig(VITAL.hp, buildShelvesCopy('hitOrStructurePoints'), true),
]
export const PATTERN_COLUMNS = [
  word('chassis', buildShelvesCopy('chassis'), true),
  word('who', buildShelvesCopy('seenBy')),
  fig(buildShelvesCopy('sys'), buildShelvesCopy('systemSlotsUsed')),
]

/** One reading's figure (`8/10`) by its label; none draws the dash. */
export const read = (readings: readonly UnitReading[] | undefined, label: string): string =>
  String(readings?.find((r) => String(r.label) === label)?.value ?? '')

/** The unit it is crewed with, as a link to its sheet. */
export const paired = (
  linked: readonly { name: string; href?: string | undefined }[]
): ReactNode => (linked[0] ? <ShelfLink href={linked[0].href}>{linked[0].name}</ShelfLink> : '')

/** The Game it is in, as a link to that Game's page. */
export const inGame = (relations: readonly { value: string; href: string }[]): ReactNode =>
  relations[0] ? <ShelfLink href={relations[0].href}>{relations[0].value}</ShelfLink> : ''

/** Who can see it, in words. */
export const who = (chips: readonly { label: string }[]): string =>
  chips.map((c) => c.label).join(', ')

/** A unit's own labels (`Shared by link`), under its name. */
export const under = (chips: readonly { label: string }[]): string | undefined =>
  chips.length > 0 ? chips.map((c) => c.label).join(' · ') : undefined
