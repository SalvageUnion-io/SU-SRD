/**
 * The Play hub's Your Games (ADR-052 §4) — pure, so `PlayLanding` only lays
 * them out. A Game is a contentful Compact (ruleset §1.9): the whole Compact
 * opens the Game's page in Play; its chips are your role, how many are here,
 * the Downtime state and its Discord channel; its body is the crew as
 * header-only Minis; its one door is the way into play, Mediate or Play <pilot>.
 */

import { sheetPath } from 'game-domain/entityKinds'
import type { LinkedUnit } from '../components/entity/LinkedUnits'
import type { PairSide } from '../lib/units/crewPair'
import { crewPair, pool } from '../lib/units/crewPair'

/** A label-first chip on a Game's Compact: `Mediator`, `3 here`, `DOWNTIME | Step 4`. */
export type HubChip = { key: string; label: string; value?: string }

/** A Game's one door, rust: where it goes and what it is called. */
export type GameDoor = { label: string; href: string; ariaLabel: string }

/**
 * A Game's chips, in order: your role in it, how many are here now (only when
 * anyone is), the Downtime state while it runs (its step, 1-based, once it
 * has one), and the Discord channel its rolls post to, once one is bound.
 */
export function gameChips(args: {
  mediator: boolean
  here: number
  downtime: { running: boolean; stepIndex: number | null } | undefined
  /** The bound channel as `#salvage-run`; null or absent with none. */
  channel?: string | null
}): HubChip[] {
  const { mediator, here, downtime, channel } = args
  return [
    { key: 'role', label: mediator ? 'Mediator' : 'Player' },
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
 * A Game's one door: Mediate where you mediate it, else Play your first pilot
 * in it; none when you have no pilot there (its page is where you add one).
 */
export function gameDoor(
  game: { _id: string; name: string; mediator: boolean },
  pilots: readonly { id: string; name: string }[]
): GameDoor | null {
  if (game.mediator) {
    return { label: 'Mediate', href: `/play/game/${game._id}`, ariaLabel: `Mediate ${game.name}` }
  }
  const pilot = pilots[0]
  if (pilot === undefined) return null
  return {
    label: `Play ${pilot.name}`,
    href: `/play/${pilot.id}`,
    ariaLabel: `Play ${pilot.name} in ${game.name}`,
  }
}

type ListedRow = { _id: string; appId: string | null; body: unknown }

/** What a Game's card reads: its crawlers (`entities.listForGame`) and its crew (`crew.vitals`). */
export type CrewSources = {
  crawlers: readonly ListedRow[]
  primaryCrawlerId: string | null
  pilots: readonly {
    _id: string
    linkId: string | null
    appId: string | null
    ownerId: string | null
    name: string
    currentHP: number | null
    maxHP: number | null
    currentAP: number | null
    maxAP: number | null
    boarded: boolean
    mechId: string | null
  }[]
  mechs: readonly {
    _id: string
    linkId: string | null
    appId: string | null
    ownerId: string | null
    name: string
    currentSP: number | null
    maxSP: number | null
    currentEP: number | null
    maxEP: number | null
    currentHeat: number | null
    maxHeat: number | null
  }[]
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
      ...pool('SP', m.currentSP, m.maxSP),
      ...pool('EP', m.currentEP, m.maxEP),
      ...pool('Heat', m.currentHeat, m.maxHeat),
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
          readings: [...pool('HP', p.currentHP, p.maxHP), ...pool('AP', p.currentAP, p.maxAP)],
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
