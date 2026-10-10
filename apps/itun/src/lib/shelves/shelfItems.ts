/**
 * What each item on the Shelves page says (issue 1279, board S1) — pure, so
 * the page only lays it out.
 *
 * Shelves is everything a player keeps, on their account: a unit in a Game
 * stays on their shelf too, so the page lists every pilot, mech and crawler
 * this browser holds for the account, wherever it is, and says where in a chip
 * under it. The "Showing" toggle narrows that to what is in no Game.
 *
 * Each item is one line — the kind and its defining fact on a stamp, the name,
 * and one reading (`HP 8/10`) — with chips under it: the Game it is in, the
 * units linked to it, where it came from, and, for a pattern, who can see it.
 */

import { resolveChassisRef, resolvePool } from 'salvageunion-reference/rules'
import { resolveClassName } from '../classRef'
import type { ContainerFields } from '../container'
import { resolveCrawlerType } from '../crawlerRefs'
import type { PatternVisibility } from '../patterns/patterns'
import { patternChassis, patternLoadout, slotsUsed } from '../patterns/patterns'
import { readReference } from '../readReference'
import type { Crawler } from '../schemas/crawler'
import type { EncounterNpc } from '../schemas/encounterNpc'
import type { Mech } from '../schemas/mech'
import type { Npc } from '../schemas/npc'
import type { MechPattern } from '../schemas/pattern'
import type { Pilot } from '../schemas/pilot'
import type { SoftLink } from '../schemas/softLink'

/** The Showing toggle: everything you keep, or only what is in no Game. */
export type ShelfFilter = 'everything' | 'not-in-game'

/** A Game the viewer is in, as `games.listMine` answers. */
export type ShelfGame = { _id: string; name: string; mediator: boolean }

/** Who can read a pattern, and how often it has been built (`shelf.patternSharing`). */
export type PatternSharing = {
  appId: string
  visibility: PatternVisibility
  gameName: string | null
  builtCount: number
}

/** One chip under an item. */
export type ShelfChip = { key: string; label: string }

/** One reading on an item's line: `HP 8/10`, `TL 1`. */
export type ShelfReading = { label: string; value: string }

/** Whether an item shows under the toggle. A unit in a Game shows under Everything. */
export function shownUnder(filter: ShelfFilter, entity: ContainerFields): boolean {
  return filter === 'everything' || typeof entity.gameId !== 'string'
}

/**
 * Whether a cached crawler is one you keep. A crawler on the shelf is; one in
 * a Game is the crew's, and this browser caches the crawler of every Game you
 * are in (`WiringSync`), so it is yours to keep only where you run the table.
 * With no Game list to ask (offline, or still loading), it is shown rather
 * than hidden: hiding a build is the one mistake a shelf must not make.
 */
export function crawlerIsKept(
  crawler: ContainerFields,
  games: readonly (ShelfGame & { tableRunner?: boolean })[] | undefined
): boolean {
  if (typeof crawler.gameId !== 'string' || games === undefined) return true
  const game = games.find((g) => g._id === crawler.gameId)
  return game === undefined || game.tableRunner === true
}

/** "Pilot · Engineer": the kind, then the one fact that says what it is. */
export function kicker(kind: string, fact: string | undefined): string {
  return fact ? `${kind} · ${fact}` : kind
}

/** The class a pilot is, by the name the book gives it. */
export function pilotFact(pilot: Pick<Pilot, 'classRef'>): string | undefined {
  return resolveClassName(pilot.classRef) || undefined
}

/** The chassis a mech or a pattern is built on ("Scrapper"). */
export function chassisFact(chassisRef: string): string | undefined {
  if (!chassisRef) return undefined
  const chassis = readReference(
    'shelfItems.chassisFact',
    () => resolveChassisRef(chassisRef) as { name: string } | null,
    null
  )
  return chassis?.name ?? chassisRef
}

/** The crawler type a crawler is ("Union Crawler"). */
export function crawlerFact(crawler: Pick<Crawler, 'type'>): string | undefined {
  return crawler.type ? (resolveCrawlerType(crawler.type)?.name ?? undefined) : undefined
}

/** A crawler's reading is its tech level: `TL 1`. */
export function crawlerReading(crawler: Pick<Crawler, 'techLevel'>): ShelfReading | undefined {
  const tl = crawler.techLevel.replace(/[^0-9]/g, '')
  return tl ? { label: 'TL', value: tl } : undefined
}

/** A pattern's reading is how full its system slots are: `SYS 12/12`. */
export function patternReading(
  pattern: Pick<MechPattern, 'chassisRef' | 'systems' | 'modules'>
): ShelfReading | undefined {
  const chassis = patternChassis(pattern)
  if (chassis === null || typeof chassis.systemSlots !== 'number') return undefined
  const used = slotsUsed(patternLoadout(pattern).systems)
  return { label: 'SYS', value: `${used}/${chassis.systemSlots}` }
}

/**
 * Where the item is: the Game's name, or "Not in a Game". A Game this viewer
 * cannot name (offline, or one they have left) is just "In a Game".
 */
export function containerChip(
  entity: ContainerFields,
  games: readonly ShelfGame[] | undefined
): ShelfChip {
  if (typeof entity.gameId !== 'string') return { key: 'where', label: 'Not in a Game' }
  const game = games?.find((g) => g._id === entity.gameId)
  return { key: 'where', label: game?.name ?? 'In a Game' }
}

/** "Copied from the Starter Set", for a unit copied from one of its templates. */
function originChip(entity: { seedRef?: string }): ShelfChip[] {
  return entity.seedRef ? [{ key: 'origin', label: 'Copied from the Starter Set' }] : []
}

type Names = ReadonlyMap<string, string>

export function pilotChips(args: {
  pilot: Pilot
  games: readonly ShelfGame[] | undefined
  softLinks: readonly SoftLink[]
  mechNames: Names
}): ShelfChip[] {
  const { pilot } = args
  const mech = args.softLinks.find((l) => l.type === 'mech-to-pilot' && l.to.id === pilot.id)
  const mechName = mech && args.mechNames.get(mech.from.id)
  return [
    containerChip(pilot, args.games),
    ...(mechName ? [{ key: 'linked', label: `Linked: ${mechName}` }] : []),
    ...originChip(pilot),
  ]
}

export function mechChips(args: {
  mech: Mech
  games: readonly ShelfGame[] | undefined
  softLinks: readonly SoftLink[]
  pilotNames: Names
  patternNames: Names
}): ShelfChip[] {
  const { mech } = args
  const pilot = args.softLinks.find((l) => l.type === 'mech-to-pilot' && l.from.id === mech.id)
  const pilotName = pilot && args.pilotNames.get(pilot.to.id)
  const patternName = mech.sourcePattern ? args.patternNames.get(mech.sourcePattern) : undefined
  return [
    containerChip(mech, args.games),
    ...(pilotName ? [{ key: 'linked', label: `Pilot: ${pilotName}` }] : []),
    ...(mech.sourcePattern
      ? [
          {
            key: 'pattern',
            label: patternName ? `From pattern “${patternName}”` : 'From a pattern',
          },
        ]
      : []),
    ...originChip(mech),
  ]
}

export function crawlerChips(args: {
  crawler: Crawler
  games: readonly ShelfGame[] | undefined
}): ShelfChip[] {
  const { crawler } = args
  const game =
    typeof crawler.gameId === 'string'
      ? args.games?.find((g) => g._id === crawler.gameId)
      : undefined
  return [
    containerChip(crawler, args.games),
    ...(game?.mediator ? [{ key: 'role', label: 'You mediate' }] : []),
    ...originChip(crawler),
  ]
}

/** How many mechs were built from a pattern, in words: "Built twice". */
export function builtTimes(count: number): string | null {
  if (count <= 0) return null
  if (count === 1) return 'Built once'
  if (count === 2) return 'Built twice'
  return `Built ${count} times`
}

/** Who can see a pattern, then how often it has been built. */
export function patternChips(sharing: PatternSharing | undefined): ShelfChip[] {
  if (sharing === undefined) return []
  const who =
    sharing.visibility === 'link'
      ? 'Shared by link'
      : sharing.visibility === 'game'
        ? sharing.gameName
          ? `Shared with ${sharing.gameName}`
          : 'Shared with a crew'
        : 'Only me'
  const built = builtTimes(sharing.builtCount)
  return [{ key: 'who', label: who }, ...(built ? [{ key: 'built', label: built }] : [])]
}

/** An NPC's reading is its hit (or structure) points: `HP 6/6`. */
export function npcReading(npc: Pick<Npc, 'hitPoints' | 'damageType' | 'currentHP'>): ShelfReading {
  return {
    label: npc.damageType,
    value: `${resolvePool(npc.currentHP, npc.hitPoints)}/${npc.hitPoints}`,
  }
}

/** An encounter-tray NPC's reading, on the same footing. */
export function encounterNpcReading(
  npc: Pick<EncounterNpc, 'currentHp' | 'maxHp' | 'statKind'>
): ShelfReading {
  return { label: npc.statKind === 'sp' ? 'SP' : 'HP', value: `${npc.currentHp}/${npc.maxHp}` }
}

/**
 * Who can see an NPC: nobody but you while it is on your shelf; the table, once
 * it is moved into a Game. A Game this viewer cannot name is just "a Game".
 */
export function npcChips(args: {
  npc: Pick<Npc, 'gameId'>
  games: readonly ShelfGame[] | undefined
}): ShelfChip[] {
  const { npc } = args
  if (typeof npc.gameId !== 'string') return [{ key: 'who', label: 'Only me' }]
  const game = args.games?.find((g) => g._id === npc.gameId)
  return [{ key: 'who', label: game ? `Shared with ${game.name}` : 'Shared with a Game' }]
}

/** The personal tray's NPCs live on the shelf alone, so only the owner sees them. */
export function encounterNpcChips(): ShelfChip[] {
  return [{ key: 'who', label: 'Only me' }]
}
