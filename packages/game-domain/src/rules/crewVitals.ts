import type { MechDerived, PilotDerived } from '../botWire'
import { MechSchema } from '../schemas/mech'
import type { Pilot } from '../schemas/pilot'
import { PilotSchema } from '../schemas/pilot'
import type { SeatMount } from '../schemas/seat'
import {
  mechMaxima,
  mechNeedsAttention,
  mechStatus,
  pilotMaxima,
  pilotNeedsAttention,
  pilotStatus,
} from './crewStatus'

/**
 * The crew's derived vitals (ADR-038 §4): each pilot's and mech's maxima and
 * status, from one container's records. The rooms' `crew.vitals` derive
 * with this, so the bot, the Game hub and Play agree on a
 * crewmate's numbers. The caller installs the reference data the rules read.
 */

/** A unit as the derivation reads it: the id links and seats name it by, and its body. */
export type CrewUnit = { id: string | undefined; body: unknown }

/** A link, as either store keeps it. */
type CrewLink = { type: string; from: { id: string }; to: { id: string } }

/** A pilot's seat, as either store keeps it. */
export type CrewSeat = {
  pilotId: string
  mount: SeatMount
  activeEffects?: readonly string[]
  ejected?: boolean
}

/** The records a derivation reads: one container's pilots, crawlers, links and seats. */
export type CrewRecords<S extends CrewSeat> = {
  pilots: readonly CrewUnit[]
  crawlers: readonly CrewUnit[]
  links: readonly CrewLink[]
  seats: readonly S[]
}

/**
 * The derivations over one container's records, with the maps they build.
 *
 * Bodies are parsed once: a mech's maxima read the abilities of the pilot
 * flying it, so every pilot is parsed up front and looked up by body.
 */
export function crewDeriver<S extends CrewSeat>({
  pilots,
  crawlers,
  links,
  seats,
}: CrewRecords<S>) {
  const crawlerTech = new Map<string, { techLevel: string }>()
  for (const c of crawlers) {
    const techLevel = (c.body as Record<string, unknown> | null)?.techLevel
    if (c.id !== undefined && typeof techLevel === 'string') crawlerTech.set(c.id, { techLevel })
  }
  const crawlerOfPilot = new Map<string, string>()
  const mechOfPilot = new Map<string, string>()
  const pilotOfMech = new Map<string, string>()
  for (const link of links) {
    if (link.type === 'pilot-to-crawler') crawlerOfPilot.set(link.from.id, link.to.id)
    if (link.type === 'mech-to-pilot') {
      mechOfPilot.set(link.to.id, link.from.id)
      pilotOfMech.set(link.from.id, link.to.id)
    }
  }
  const seatOf = new Map(seats.map((s) => [s.pilotId, s]))
  const boarderOf = new Map<string, string>()
  for (const s of seats) if (s.mount.kind === 'boarded') boarderOf.set(s.mount.mechId, s.pilotId)

  const parsedByBody = new Map<unknown, Pilot | null>()
  const parsedPilots = new Map<string, Pilot>()
  function parsePilot(body: unknown): Pilot | null {
    const known = parsedByBody.get(body)
    if (known !== undefined) return known
    const parsed = PilotSchema.safeParse(body)
    const pilot = parsed.success ? parsed.data : null
    parsedByBody.set(body, pilot)
    return pilot
  }
  for (const unit of pilots) {
    const pilot = parsePilot(unit.body)
    if (unit.id !== undefined && pilot !== null) parsedPilots.set(unit.id, pilot)
  }

  function derivePilot(unit: CrewUnit): PilotDerived {
    const id = unit.id ?? null
    const pilot = parsePilot(unit.body)
    const ejected = id === null ? false : seatOf.get(id)?.ejected === true
    if (pilot === null) {
      const status = { dead: false, injured: false, ejected }
      return { maxHP: null, maxAP: null, status, attention: pilotNeedsAttention(status) }
    }
    const crawlerId = id === null ? undefined : crawlerOfPilot.get(id)
    const crawler = crawlerId === undefined ? null : (crawlerTech.get(crawlerId) ?? null)
    const { maxHP, maxAP } = pilotMaxima(pilot, crawler)
    const status = pilotStatus(pilot, crawler, ejected)
    return { maxHP, maxAP, status, attention: pilotNeedsAttention(status) }
  }

  function deriveMech(unit: CrewUnit): MechDerived {
    const parsed = MechSchema.safeParse(unit.body)
    if (!parsed.success) {
      return { maxSP: null, maxEP: null, maxHeat: null, status: null, attention: false }
    }
    const mech = parsed.data
    const id = unit.id ?? null
    // The pilot aboard it, else the pilot assigned to it, as Play
    // reads its own mech: their abilities, and the effects their seat has on.
    const pilotId = id === null ? undefined : (boarderOf.get(id) ?? pilotOfMech.get(id))
    const piloting = pilotId === undefined ? undefined : parsedPilots.get(pilotId)
    const switchedOn = pilotId === undefined ? [] : (seatOf.get(pilotId)?.activeEffects ?? [])
    const { maxSP, maxEP, maxHeat } = mechMaxima(mech, piloting?.abilities, switchedOn)
    const status = mechStatus(mech, maxHeat)
    return { maxSP, maxEP, maxHeat, status, attention: mechNeedsAttention(status) }
  }

  return { seatOf, mechOfPilot, derivePilot, deriveMech }
}
