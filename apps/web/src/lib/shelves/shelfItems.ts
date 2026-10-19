/**
 * What each item in the Hangar says (board S1) — pure, so the page only lays
 * it out.
 *
 * The Hangar is everything a player owns, on their account (ADR-052 §1–2): a
 * unit in a Game stays in their Hangar too, so the page lists every pilot,
 * mech and crawler of theirs this browser holds, wherever it is, and names its
 * Game in a relation chip. The "Showing" select narrows that to what is in no
 * Game, or to one Game's.
 *
 * Each item is one line — the kind and its defining fact on a stamp, the name,
 * and one reading (`HP 8/10`) — with chips: for a pattern or NPC who can see
 * it, then the units linked to it and its Game as relations
 * (`PILOT | Bonesaw`, `GAME | The Long Haul`).
 */

import type { ContainerFields } from 'game-domain/container'
import { gamePath } from 'game-domain/entityKinds'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { EncounterNpc } from 'game-domain/schemas/encounterNpc'
import type { Mech } from 'game-domain/schemas/mech'
import type { Npc } from 'game-domain/schemas/npc'
import type { MechPattern } from 'game-domain/schemas/pattern'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { SoftLink } from 'game-domain/schemas/softLink'
import { resolveChassisRef, resolvePool } from 'salvageunion-reference/rules'
import { resolveClassName } from '../classRef'
import { resolveCrawlerType } from '../crawlerRefs'
import type { PatternVisibility } from '../patterns/patterns'
import { patternChassis, patternLoadout, slotsUsed } from '../patterns/patterns'
import { readReference } from '../readReference'

/** The Showing select: everything you own, what is in no Game, or one Game's (`game:<id>`). */
export type ShelfFilter = 'everything' | 'not-in-game' | `game:${string}`

/** A Game the viewer is in, as `games.listMine` answers. */
export type ShelfGame = { _id: string; name: string; mediator: boolean }

/**
 * The Hangar's "Showing" choices, in order: Everything, Not in a Game, then one
 * entry per Game (ADR-052 §1). With no Game list to ask, the first two alone.
 */
export function shelfFilters(
  games: readonly Pick<ShelfGame, '_id' | 'name'>[] | undefined
): { value: ShelfFilter; label: string }[] {
  return [
    { value: 'everything', label: 'Everything' },
    { value: 'not-in-game', label: 'Not in a Game' },
    ...(games ?? []).map((g) => ({ value: `game:${g._id}` as const, label: g.name })),
  ]
}

/** Who can read a pattern, and how often it has been built (`shelf.patternSharing`). */
export type PatternSharing = {
  appId: string
  visibility: PatternVisibility
  gameName: string | null
  builtCount: number
}

/** One of an item's own chips: label-only (`Only me`), or split when it has a value. */
export type ShelfChip = { key: string; label: string; value?: string }

/**
 * A unit or Game linked to the item, as its relation chip
 * (`chips-and-actions.md` C11): what it is (`Mech`, `Game`), its name, and
 * where it opens (a unit's sheet, a Game's page in Play).
 */
export type ShelfRelation = { key: string; label: string; value: string; href: string }

/** One reading on an item's line: `HP 8/10`, `TL 1`. */
export type ShelfReading = { label: string; value: string }

/** Whether an item shows under the Showing select. A unit in a Game shows under Everything. */
export function shownUnder(filter: ShelfFilter, entity: ContainerFields): boolean {
  if (filter === 'everything') return true
  if (filter === 'not-in-game') return typeof entity.gameId !== 'string'
  return entity.gameId === filter.slice('game:'.length)
}

/**
 * Whether a cached crawler is one you keep. A crawler in your Hangar is; one in
 * a Game is the crew's, and this browser caches the crawler of every Game you
 * are in (`WiringSync`), so it is yours to keep only where you run the table.
 * With no Game list to ask (offline, or still loading), it is shown rather
 * than hidden: hiding a build is the one mistake a Hangar must not make.
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
 * The Game the item is in, as its relation chip: `GAME | its name`, opening
 * the Game's page in Play (C11). In no Game, nothing: the lane stays empty
 * (C6), never an "Unassigned" chip. A Game this viewer cannot name (offline,
 * or one they have left) still links, as "A Game".
 */
export function gameRelation(
  entity: ContainerFields,
  games: readonly ShelfGame[] | undefined
): ShelfRelation[] {
  const gameId = entity.gameId
  if (typeof gameId !== 'string') return []
  const game = games?.find((g) => g._id === gameId)
  return [{ key: 'game', label: 'Game', value: game?.name ?? 'A Game', href: gamePath(gameId) }]
}

type Names = ReadonlyMap<string, string>

/** The mech a pilot is assigned to, as its relation: `MECH | Scrapper`. */
export function pilotRelations(args: {
  pilot: Pick<Pilot, 'id'>
  softLinks: readonly SoftLink[]
  mechNames: Names
}): ShelfRelation[] {
  const link = args.softLinks.find((l) => l.type === 'mech-to-pilot' && l.to.id === args.pilot.id)
  const name = link && args.mechNames.get(link.from.id)
  return link && name
    ? [{ key: 'mech', label: 'Mech', value: name, href: `/sheet/mech/${link.from.id}` }]
    : []
}

/** The pilot a mech carries, as its relation: `PILOT | Bonesaw`. */
export function mechRelations(args: {
  mech: Pick<Mech, 'id'>
  softLinks: readonly SoftLink[]
  pilotNames: Names
}): ShelfRelation[] {
  const link = args.softLinks.find((l) => l.type === 'mech-to-pilot' && l.from.id === args.mech.id)
  const name = link && args.pilotNames.get(link.to.id)
  return link && name
    ? [{ key: 'pilot', label: 'Pilot', value: name, href: `/sheet/pilot/${link.to.id}` }]
    : []
}

/** A crawler in a Game you mediate says so. */
export function crawlerChips(args: {
  crawler: Crawler
  games: readonly ShelfGame[] | undefined
}): ShelfChip[] {
  const { crawler } = args
  const game =
    typeof crawler.gameId === 'string'
      ? args.games?.find((g) => g._id === crawler.gameId)
      : undefined
  return game?.mediator ? [{ key: 'role', label: 'You mediate' }] : []
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
 * nobody but you while it is in your Hangar. In a Game the table sees it, which
 * its Game relation (`gameRelation`) already says, so no chip repeats it.
 */
export function npcChips(args: { npc: Pick<Npc, 'gameId'>; sharedByLink?: boolean }): ShelfChip[] {
  if (args.sharedByLink) return [{ key: 'who', label: 'Shared by link' }]
  if (typeof args.npc.gameId !== 'string') return [{ key: 'who', label: 'Only me' }]
  return []
}

/** The personal tray's NPCs live in the Hangar alone, so only the owner sees them. */
export function encounterNpcChips(): ShelfChip[] {
  return [{ key: 'who', label: 'Only me' }]
}
