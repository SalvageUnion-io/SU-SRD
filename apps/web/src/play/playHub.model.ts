/**
 * The Play hub's Your Games (ADR-052 §4) — pure, so `PlayLanding` only lays
 * them out. A Game is a contentful Compact (ruleset §1.9): the whole Compact
 * opens the Game's page in Play; its chips are your role, how many are here,
 * the Downtime state and its Discord channel; its body is the crew as
 * header-only Minis; its doors are the ways into play: the group session
 * (Start group session, then Mediate) and Play <pilot>.
 */

import { cockpitPath, mediatePath, sheetPath } from 'game-domain/entityKinds'
import { parseCrawlerTechLevel } from 'salvageunion-reference/rules'
import type { LinkedUnit } from '../components/entity/LinkedUnits'
import type { PairSide } from '../lib/units/crewPair'
import { crewPair, gauge, pool } from '../lib/units/crewPair'
import { techLevelReading, VITAL } from '../lib/units/readings'
import { playCopy } from '../messages/play'
import { gamePrepPath } from './games/prep/gamePrep.model'
import { sessionDoor, sessionDoorAs } from './sessionDoor.model'
import type { CrewVitals } from './useGameFeed'

/** A label-first chip on a Game's Compact: `Mediator`, `3 here`, `DOWNTIME | Step 4`. */
export type HubChip = { key: string; label: string; value?: string }

/**
 * One of a Game's doors: where it goes and what it is called. A `start` door
 * starts the group session first (the table runner's, before one is live).
 */
export type GameDoor = { label: string; href: string; ariaLabel: string; start?: true }

/**
 * A Game's chips, in order: your role in it, Session live while a group
 * session runs, how many are here now (only when
 * anyone is), the Downtime state while it runs (its step, 1-based, once it
 * has one), and the Discord channel its rolls post to, once one is bound.
 */
export function gameChips(args: {
  mediator: boolean
  /** A group session is running (`session.state`). */
  live?: boolean
  here: number
  downtime: { running: boolean; stepIndex: number | null } | undefined
  /** The bound channel as `#salvage-run`; null or absent with none. */
  channel?: string | null
  /** Proposals still open: the viewer's to answer and the ones they sent (r7 C11). */
  pending?: number
  /** When the table last played, as it reads (`2 days ago`); null or absent when it never has. */
  played?: string | null
  /** The next plan (`sessionPlans`); null or absent with none. */
  next?: string | null
}): HubChip[] {
  const { mediator, live = false, here, downtime, channel, pending = 0, played, next } = args
  return [
    { key: 'role', label: mediator ? 'Mediator' : 'Player' },
    ...(live ? [{ key: 'session', label: playCopy('sessionLive') }] : []),
    ...(here > 0 ? [{ key: 'here', label: `${here} here` }] : []),
    ...(downtime?.running
      ? [
          {
            key: 'downtime',
            label: 'Downtime',
            ...(downtime.stepIndex !== null ? { value: `Step ${downtime.stepIndex + 1}` } : {}),
          },
        ]
      : []),
    ...(pending > 0
      ? [
          {
            key: 'pending',
            label: playCopy('proposals'),
            value: playCopy('nPending', { n: pending }),
          },
        ]
      : []),
    ...(played ? [{ key: 'played', label: playCopy('lastPlayed'), value: played }] : []),
    ...(next ? [{ key: 'next', label: playCopy('nextPlan'), value: next }] : []),
    ...(channel ? [{ key: 'channel', label: channel }] : []),
  ]
}

/**
 * A Game's doors, in order: the Mediator's first (Start group session until
 * one is live, never while the session is unknown; then Mediate and Prep,
 * always, so looking at the table announces nothing: MD4-13), then one for each pilot of yours in it
 * (Join session while one is live, else Open table: `sessionDoor`; with
 * several pilots each door adds its callsign), so a Mediator
 * who also plays and a player with two pilots reach every one of them. None
 * when you neither mediate nor have a pilot there (its page is where you add one).
 */
export function gameDoors(
  game: { _id: string; name: string; mediator: boolean },
  pilots: readonly { id: string; name: string }[],
  /** A group session is live; null while unknown (loading, or no connection), read as not live but with no Start. */
  live: boolean | null = null
): GameDoor[] {
  // The quiet ways in: neither starts a session.
  const quiet: GameDoor[] = [
    { label: 'Mediate', href: mediatePath(game._id), ariaLabel: `Mediate ${game.name}` },
    {
      label: playCopy('prep'),
      href: gamePrepPath(game._id),
      ariaLabel: playCopy('prepOf', { game: game.name }),
    },
  ]
  const runner: GameDoor[] = !game.mediator
    ? []
    : live !== false
      ? quiet
      : [
          {
            // Short on the hub's head, so the Game's name keeps its room (C2b); the
            // accessible name says it in full.
            label: playCopy('startSession'),
            href: mediatePath(game._id),
            ariaLabel: playCopy('startGroupSessionOf', { game: game.name }),
            start: true,
          },
          ...quiet,
        ]
  return [
    ...runner,
    // The seat's door has the Game's two names, as on its page (glossary §9,
    // r3 H3); two pilots' doors are told apart by callsign.
    ...pilots.map((pilot) => ({
      label:
        pilots.length === 1
          ? sessionDoor(live === true)
          : `${sessionDoor(live === true)} · ${pilot.name}`,
      href: cockpitPath(pilot.id),
      ariaLabel: sessionDoorAs(live === true, pilot.name, game.name),
    })),
  ]
}

type ListedRow = { _id: string; appId: string | null; body: unknown }

/** What a Game's card reads: its crawlers (`useGameListing`) and its crew (`crew.vitals`). */
export type CrewSources = {
  crawlers: readonly ListedRow[]
  primaryCrawlerId: string | null
  pilots: readonly Pick<
    CrewVitals['pilots'][number],
    | '_id'
    | 'linkId'
    | 'appId'
    | 'ownerId'
    | 'name'
    | 'currentHP'
    | 'maxHP'
    | 'currentAP'
    | 'maxAP'
    | 'boarded'
    | 'mechId'
  >[]
  mechs: readonly Pick<
    CrewVitals['mechs'][number],
    | '_id'
    | 'linkId'
    | 'appId'
    | 'ownerId'
    | 'name'
    | 'currentSP'
    | 'maxSP'
    | 'currentEP'
    | 'maxEP'
    | 'currentHeat'
    | 'maxHeat'
    | 'techLevel'
  >[]
}

const bodyText = (body: unknown, key: string): string | null => {
  const value = (body as Record<string, unknown> | null)?.[key]
  return typeof value === 'string' && value !== '' ? value : null
}

/** One line of a Game's crew: whose it is, and whether a pilot leads it (aboard or on foot). */
export type CrewEntry = { ownerId: string | null; pilot: boolean; unit: LinkedUnit }

/**
 * The pilots and mechs of a Game as linked Minis with their chips, each pilot
 * paired with its mech (`crewPair`: the mech while the pilot is aboard, else
 * the pilot), then the mechs no pilot is assigned; each with whose it is, so
 * a member's card can list its own.
 */
export function pairedCrew(sources: Pick<CrewSources, 'pilots' | 'mechs'>): CrewEntry[] {
  const mechs = new Map(sources.mechs.map((m) => [m.linkId ?? m._id, m]))
  const mechSide = (m: CrewSources['mechs'][number]): PairSide => ({
    id: m._id,
    name: m.name,
    href: sheetPath('mech', m.linkId ?? m.appId ?? m._id),
    readings: [
      ...techLevelReading(m.techLevel),
      ...pool(VITAL.sp, m.currentSP, m.maxSP),
      ...pool(VITAL.ep, m.currentEP, m.maxEP),
      ...gauge(VITAL.heat, m.currentHeat, m.maxHeat),
    ],
  })
  const out: CrewEntry[] = []
  const placed = new Set<string>()
  for (const p of sources.pilots) {
    const mech = p.mechId === null ? undefined : mechs.get(p.mechId)
    if (mech !== undefined && p.mechId !== null) placed.add(p.mechId)
    out.push({
      ownerId: p.ownerId,
      pilot: true,
      unit: crewPair({
        pilot: {
          id: p._id,
          name: p.name,
          href: sheetPath('pilot', p.linkId ?? p.appId ?? p._id),
          readings: [
            ...pool(VITAL.hp, p.currentHP, p.maxHP),
            ...pool(VITAL.ap, p.currentAP, p.maxAP),
          ],
        },
        mech: mech === undefined ? null : mechSide(mech),
        boarded: p.boarded,
      }),
    })
  }
  for (const [id, m] of mechs) {
    if (placed.has(id)) continue
    const side = mechSide(m)
    out.push({
      ownerId: m.ownerId,
      pilot: false,
      unit: { key: `mech:${m._id}`, kind: 'mech', ...side },
    })
  }
  return out
}

/**
 * A Game's crew on its card, read-only, each a header-only Mini with its
 * chips that opens its sheet in Build (Play lists the crew, Build keeps it):
 * the viewer's own pilots first, each marked Yours (r7 C11), then the crawler
 * (the primary first), then everyone else's pilots and mechs (`pairedCrew`).
 */
export function gameCrew(sources: CrewSources, viewerId: string | null = null): LinkedUnit[] {
  const crawlers = [...sources.crawlers].sort(
    (a, b) =>
      Number(b._id === sources.primaryCrawlerId) - Number(a._id === sources.primaryCrawlerId)
  )
  const crew = pairedCrew(sources)
  const isMine = (p: CrewEntry) => viewerId !== null && p.pilot && p.ownerId === viewerId
  const mine = crew.filter(isMine).map(
    ({ unit }): LinkedUnit => ({
      ...unit,
      relations: [...(unit.relations ?? []), { key: 'yours', name: playCopy('yours') }],
    })
  )
  return [
    ...mine,
    ...crawlers.map(
      (c): LinkedUnit => ({
        key: `crawler:${c._id}`,
        kind: 'crawler',
        name: bodyText(c.body, 'name') ?? 'Crawler',
        href: sheetPath('crawler', c.appId ?? bodyText(c.body, 'id') ?? c._id),
        readings: techLevelReading(
          parseCrawlerTechLevel((c.body as Record<string, unknown> | null)?.techLevel)
        ),
      })
    ),
    ...crew.filter((p) => !isMine(p)).map((p) => p.unit),
  ]
}
