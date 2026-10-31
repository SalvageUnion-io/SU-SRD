/**
 * The Play hub's Your Games (ADR-052 §4) — pure, so `PlayLanding` only lays
 * them out. A Game is a contentful Compact (ruleset §1.9): the whole Compact
 * opens the Game's page in Play; its chips are your role, how many are here,
 * the Downtime state and its Discord channel; its body is the crew as
 * header-only Minis; its doors are the ways into play: the group session
 * (Start group session, then Mediate) and Play or Join as <pilot>.
 */

import { cockpitPath, mediatePath, sheetPath } from 'game-domain/entityKinds'
import type { LinkedUnit } from '../components/entity/LinkedUnits'
import type { PairSide } from '../lib/units/crewPair'
import { crewPair, gauge, pool } from '../lib/units/crewPair'
import { VITAL } from '../lib/units/readings'
import { playCopy } from '../messages/play'
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
}): HubChip[] {
  const { mediator, live = false, here, downtime, channel } = args
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
    ...(channel ? [{ key: 'channel', label: channel }] : []),
  ]
}

/**
 * A Game's doors, in order: the table runner's first (Start group session
 * until one is live, then Mediate; Mediate while the session is unknown), then one for each pilot of yours in it
 * (Join as <pilot> while a session is live, else Play <pilot>), so a Mediator
 * who also plays and a player with two pilots reach every one of them. None
 * when you neither mediate nor have a pilot there (its page is where you add one).
 */
export function gameDoors(
  game: { _id: string; name: string; mediator: boolean },
  pilots: readonly { id: string; name: string }[],
  /** A group session is live; null while unknown (loading, or no connection), read as not live but with no Start. */
  live: boolean | null = null
): GameDoor[] {
  const runner: GameDoor[] = !game.mediator
    ? []
    : live !== false
      ? [{ label: 'Mediate', href: mediatePath(game._id), ariaLabel: `Mediate ${game.name}` }]
      : [
          {
            // Short on the hub's head, so the Game's name keeps its room (C2b); the
            // accessible name says it in full.
            label: playCopy('startSession'),
            href: mediatePath(game._id),
            ariaLabel: playCopy('startGroupSessionOf', { game: game.name }),
            start: true,
          },
        ]
  return [
    ...runner,
    ...pilots.map((pilot) =>
      live
        ? {
            label: playCopy('joinAs', { name: pilot.name }),
            href: cockpitPath(pilot.id),
            ariaLabel: playCopy('joinSessionAs', { game: game.name, name: pilot.name }),
          }
        : {
            label: `Play ${pilot.name}`,
            href: cockpitPath(pilot.id),
            ariaLabel: `Play ${pilot.name} in ${game.name}`,
          }
    ),
  ]
}

type ListedRow = { _id: string; appId: string | null; body: unknown }

/** What a Game's card reads: its crawlers (`entities.listForGame`) and its crew (`crew.vitals`). */
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
  >[]
}

const bodyText = (body: unknown, key: string): string | null => {
  const value = (body as Record<string, unknown> | null)?.[key]
  return typeof value === 'string' && value !== '' ? value : null
}

/**
 * The pilots and mechs of a Game as linked Minis with their chips, each pilot
 * paired with its mech (`crewPair`: the mech while the pilot is aboard, else
 * the pilot), then the mechs no pilot is assigned; each with whose it is, so
 * a member's card can list its own.
 */
export function pairedCrew(
  sources: Pick<CrewSources, 'pilots' | 'mechs'>
): { ownerId: string | null; unit: LinkedUnit }[] {
  const mechs = new Map(sources.mechs.map((m) => [m.linkId ?? m._id, m]))
  const mechSide = (m: CrewSources['mechs'][number]): PairSide => ({
    id: m._id,
    name: m.name,
    href: sheetPath('mech', m.linkId ?? m.appId ?? m._id),
    readings: [
      ...pool(VITAL.sp, m.currentSP, m.maxSP),
      ...pool(VITAL.ep, m.currentEP, m.maxEP),
      ...gauge(VITAL.heat, m.currentHeat, m.maxHeat),
    ],
  })
  const out: { ownerId: string | null; unit: LinkedUnit }[] = []
  const placed = new Set<string>()
  for (const p of sources.pilots) {
    const mech = p.mechId === null ? undefined : mechs.get(p.mechId)
    if (mech !== undefined && p.mechId !== null) placed.add(p.mechId)
    out.push({
      ownerId: p.ownerId,
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
      unit: { key: `mech:${m._id}`, kind: 'mech', ...side },
    })
  }
  return out
}

/**
 * A Game's crew on its card, read-only, each a header-only Mini with its
 * chips that opens its sheet in Build (Play lists the crew, Build keeps it):
 * the crawler (the primary first), then the pilots and mechs (`pairedCrew`).
 */
export function gameCrew(sources: CrewSources): LinkedUnit[] {
  const crawlers = [...sources.crawlers].sort(
    (a, b) =>
      Number(b._id === sources.primaryCrawlerId) - Number(a._id === sources.primaryCrawlerId)
  )
  return [
    ...crawlers.map(
      (c): LinkedUnit => ({
        key: `crawler:${c._id}`,
        kind: 'crawler',
        name: bodyText(c.body, 'name') ?? 'Crawler',
        href: sheetPath('crawler', c.appId ?? bodyText(c.body, 'id') ?? c._id),
      })
    ),
    ...pairedCrew(sources).map((p) => p.unit),
  ]
}
