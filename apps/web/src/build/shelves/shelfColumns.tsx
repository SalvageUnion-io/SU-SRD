/**
 * The Training Bay shelves' columns and cells, in the Ledger form: a shelf's
 * columns in the one order (ruleset §2.6), and what a cell reads from a unit.
 */
import type { ReactNode } from 'react'
import type { LedgerColumn } from '../../components/index'
import { HP_OR_SP } from '../../lib/shelves/shelfItems'
import { VITAL } from '../../lib/units/readings'
import type { UnitReading } from '../../lib/units/unitModel'
import { buildShelvesCopy } from '../../messages/build-shelves'
import { ShelfLink } from './ShelfLedger'

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
// A mech a pilot flies is on that pilot's line; this shelf holds the rest.
// Its build figures (Tech Level, slots filled, Scrap) tell two mechs on one
// chassis apart; they and its live ones stand in the one stat order (§2.6).
// A narrow shelf spares the live ones first (an unflown mech stands at full).
const spare = (column: LedgerColumn): LedgerColumn => ({ ...column, spare: true })
export const MECH_COLUMNS = [
  word('chassis', buildShelvesCopy('chassis'), true),
  // Which pattern it was built from, and it sorts (r5 D4).
  word('pattern', buildShelvesCopy('pattern')),
  GAME,
  fig(buildShelvesCopy('tl'), buildShelvesCopy('techLevel')),
  spare(fig(VITAL.sp, buildShelvesCopy('structurePoints'))),
  spare(fig(VITAL.ep, buildShelvesCopy('energyPoints'))),
  fig(buildShelvesCopy('sys'), buildShelvesCopy('systemSlotsUsed')),
  fig(buildShelvesCopy('mod'), buildShelvesCopy('moduleSlotsUsed')),
  spare(fig(VITAL.heat, buildShelvesCopy('heat'))),
  fig(buildShelvesCopy('cost'), buildShelvesCopy('scrapChassisAndLoadout'), true),
]
export const CRAWLER_COLUMNS = [
  word('type', buildShelvesCopy('type'), true),
  GAME,
  fig(buildShelvesCopy('tl'), buildShelvesCopy('techLevel')),
  fig(VITAL.sp, buildShelvesCopy('structurePoints')),
]
export const NPC_COLUMNS = [
  word('position', buildShelvesCopy('position')),
  word('who', buildShelvesCopy('seenBy')),
  GAME,
  // An NPC's track is HP or SP (`SP 39/39`), so the head says both (MD3-15).
  { ...fig(VITAL.hp, buildShelvesCopy('hitOrStructurePoints'), true), label: HP_OR_SP },
]
// What tells two patterns of one name apart (r4 E13, r5 D3). Beside the other column
// the panel is narrow: it spares all but the chassis and Systems (the Patterns
// page and a pattern's own page say the rest), so its make and each line's
// menu stay inside the frame.
export const PATTERN_COLUMNS = [
  word('chassis', buildShelvesCopy('chassis'), true),
  spare(word('who', buildShelvesCopy('seenBy'))),
  spare(fig(buildShelvesCopy('tl'), buildShelvesCopy('techLevel'))),
  fig(buildShelvesCopy('sys'), buildShelvesCopy('systemSlotsUsed')),
  spare(fig(buildShelvesCopy('mod'), buildShelvesCopy('moduleSlotsUsed'))),
  // Its Scrap and the moment it was saved tell two of one name apart (r5 D3).
  spare(fig(buildShelvesCopy('cost'), buildShelvesCopy('scrapChassisAndLoadout'))),
  spare(word('saved', buildShelvesCopy('saved'))),
]

/** One reading's figure (`8/10`) by its label; none draws the dash. */
export const read = (readings: readonly UnitReading[] | undefined, label: string): string =>
  String(readings?.find((r) => String(r.label) === label)?.value ?? '')

/**
 * A pilot's mech, as a link to its sheet; with none, the way to add one
 * (`add`, where a write could land: `AddAMech`), else the dash.
 */
export const paired = (
  linked: readonly { name: string; href?: string | undefined }[],
  add?: ReactNode
): ReactNode =>
  linked[0] ? <ShelfLink href={linked[0].href}>{linked[0].name}</ShelfLink> : (add ?? '')

/** The Game it is in, as a link to that Game's page. */
export const inGame = (relations: readonly { value: string; href: string }[]): ReactNode =>
  relations[0] ? <ShelfLink href={relations[0].href}>{relations[0].value}</ShelfLink> : ''

/** Who can see it, in words. */
export const who = (chips: readonly { label: string }[]): string =>
  chips.map((c) => c.label).join(', ')

/** A unit's own labels (`Shared by link`), under its name. */
export const under = (chips: readonly { label: string }[]): string | undefined =>
  chips.length > 0 ? chips.map((c) => c.label).join(' · ') : undefined

/**
 * A row's labels under its name, and a pilot's mech (`flown`) as a link there
 * on a phone, where the Mech column is hidden: the mech is never out of reach.
 */
export const underWith = (
  chips: readonly { label: string }[],
  flown: readonly { name: string; href?: string | undefined }[]
): ReactNode => {
  const labels = under(chips)
  const mech = flown[0]
  if (!mech) return labels
  return (
    <>
      {labels && <span>{labels}</span>}
      <span className="su-shelf-ledger__flown">
        {buildShelvesCopy('mech')} <ShelfLink href={mech.href}>{mech.name}</ShelfLink>
      </span>
    </>
  )
}

/**
 * A mech's labels under its name, and the pilot who flies it as a link there
 * (r4 E20): the Mechs shelf lists every mech, and a flown one says whose it is.
 */
export const underPilot = (
  chips: readonly { label: string }[],
  flownBy: readonly { name: string; href?: string | undefined }[]
): ReactNode => {
  const labels = under(chips)
  const pilot = flownBy[0]
  if (!pilot) return labels
  return (
    <>
      {labels && <span>{labels}</span>}
      <span>
        {buildShelvesCopy('pilot')} <ShelfLink href={pilot.href}>{pilot.name}</ShelfLink>
      </span>
    </>
  )
}
