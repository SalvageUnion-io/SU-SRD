/**
 * What each item on the Shelves page says (board S1) — pure, so
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

import type { ContainerFields } from 'cantina-domain/container'
import type { Crawler } from 'cantina-domain/schemas/crawler'
import type { EncounterNpc } from 'cantina-domain/schemas/encounterNpc'
import type { Mech } from 'cantina-domain/schemas/mech'
import type { Npc } from 'cantina-domain/schemas/npc'
import type { MechPattern } from 'cantina-domain/schemas/pattern'
import type { Pilot } from 'cantina-domain/schemas/pilot'
import type { SoftLink } from 'cantina-domain/schemas/softLink'
import { resolveChassisRef, resolvePool } from 'salvageunion-reference/rules'
import { resolveClassName } from '../classRef'
import { resolveCrawlerType } from '../crawlerRefs'
import type { PatternVisibility } from '../patterns/patterns'
import { patternChassis, patternLoadout, slotsUsed } from '../patterns/patterns'
import { readReference } from '../readReference'

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
/**
 * One of an item's own chips: label-only (`Only me`), a split chip when it
 * has a value (`GAME | The Long Haul`), and hollow, an outline on the band,
 * for the absence of one (`Unassigned`).
 */
export type ShelfChip = { key: string; label: string; value?: string; hollow?: boolean }

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
 * Where the item is: `GAME | its name`, or a hollow "Unassigned" (owner,
 * 2026-10-15). A Game this viewer cannot name (offline, or one they have
 * left) is just "In a Game".
 */
export function containerChip(
  entity: ContainerFields,
  games: readonly ShelfGame[] | undefined
): ShelfChip {
  if (typeof entity.gameId !== 'string') return { key: 'where', label: 'Unassigned', hollow: true }
  const game = games?.find((g) => g._id === entity.gameId)
  return game
    ? { key: 'where', label: 'Game', value: game.name }
    : { key: 'where', label: 'In a Game' }
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
    ...(mechName ? [{ key: 'linked', label: `Assigned: ${mechName}` }] : []),
  ]
}

export function mechChips(args: {
  mech: Mech
  games: readonly ShelfGame[] | undefined
  softLinks: readonly SoftLink[]
  pilotNames: Names
}): ShelfChip[] {
  const { mech } = args
  const pilot = args.softLinks.find((l) => l.type === 'mech-to-pilot' && l.from.id === mech.id)
  const pilotName = pilot && args.pilotNames.get(pilot.to.id)
  return [
    containerChip(mech, args.games),
    ...(pilotName ? [{ key: 'linked', label: `Pilot: ${pilotName}` }] : []),
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
  ]
}

/** Who can see a pattern. */
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
  return [{ key: 'who', label: who }]
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
 * The chip a pilot, mech or crawler anyone with the link may read carries
 * (`shelf.sharedByLink`): the words a pattern shared by link wears.
 */
export function linkChip(sharedByLink: readonly string[] | undefined, id: string): ShelfChip[] {
  return sharedByLink?.includes(id) ? [{ key: 'link', label: 'Shared by link' }] : []
}

/**
 * Who can see an NPC: anyone with the link once its owner shares it so; else
 * nobody but you while it is on your shelf, and the table once it is moved into
 * a Game. A Game this viewer cannot name is just "a Game".
 */
export function npcChips(args: {
  npc: Pick<Npc, 'gameId'>
  games: readonly ShelfGame[] | undefined
  sharedByLink?: boolean
}): ShelfChip[] {
  const { npc } = args
  if (args.sharedByLink) return [{ key: 'who', label: 'Shared by link' }]
  if (typeof npc.gameId !== 'string') return [{ key: 'who', label: 'Only me' }]
  const game = args.games?.find((g) => g._id === npc.gameId)
  return [{ key: 'who', label: game ? `Shared with ${game.name}` : 'Shared with a Game' }]
}

/** The personal tray's NPCs live on the shelf alone, so only the owner sees them. */
export function encounterNpcChips(): ShelfChip[] {
  return [{ key: 'who', label: 'Only me' }]
}
