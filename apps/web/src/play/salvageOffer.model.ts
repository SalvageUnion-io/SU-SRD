/**
 * A wreck's salvage as the crew answers it (r7 D8, ADR-030 §4 as amended):
 * the Mediator's pick is offered, and a crewmate may take another the roll
 * allows. Read only by the lazy `SalvagePickDialog`, never by the root's
 * notices, which load on every page.
 */

import type { SalvageOffer } from 'game-domain/games/proposals'
import type { WreckPart } from 'game-domain/rules/wreck'
import { mechSalvageAllows } from 'salvageunion-reference/rules'
import { playSalvageCopy } from '../messages/play-salvage'

/** One part as the dialog offers it: whether it is picked, and whether it may be pressed. */
export type OfferChoice = { part: WreckPart; label: string; pressed: boolean; enabled: boolean }

function allows(offer: SalvageOffer, keys: readonly string[]): boolean {
  const chosen = offer.parts.filter((p) => keys.includes(p.key))
  return mechSalvageAllows(offer.band, {
    chassis: chosen.some((p) => p.kind === 'chassis'),
    systems: chosen.filter((p) => p.kind === 'system').length,
    modules: chosen.filter((p) => p.kind === 'module').length,
  })
}

/** Each part of the wreck: a picked one can always go, another joins only while the roll allows it. */
export function offerChoices(offer: SalvageOffer, picked: readonly string[]): OfferChoice[] {
  return offer.parts.map((part) => {
    const pressed = picked.includes(part.key)
    const tl = part.techLevel ?? '?'
    return {
      part,
      label:
        part.salvageValue <= 1
          ? playSalvageCopy('partOne', { name: part.name, tl })
          : playSalvageCopy('part', { name: part.name, tl, sv: part.salvageValue }),
      pressed,
      enabled: pressed || allows(offer, [...picked, part.key]),
    }
  })
}

/** The pick with `key` pressed: in if it was out, out if it was in. */
export const togglePick = (picked: readonly string[], key: string): string[] =>
  picked.includes(key) ? picked.filter((k) => k !== key) : [...picked, key]

/** Whether `picked` answers with another pick than the Mediator offered. */
export const isChangedPick = (offer: SalvageOffer, picked: readonly string[]): boolean =>
  [...picked].sort().join('\n') !== [...offer.picked].sort().join('\n')
