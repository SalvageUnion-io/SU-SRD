/**
 * deckActivation — paying for one activation, the single non-destructive
 * bookkeeping write of a resolve (ADR-007; `useActionsDeck` drives it). What
 * is spent follows whose action it is:
 *
 *  - on the pilot's AP: the AP spend (`pilotActivationPatch`);
 *  - a companion's: its own EP, Heat and Uses, on its host's record ("uses
 *    the same rules as Mechs": `companionNow`, `replacePartner`);
 *  - the mech's: EP, Hot Heat and Uses (`activationPatch`).
 *
 * An EP or AP spend says itself with Undo (chrome K5, `changeUndoToast`),
 * which writes the value the spend started from. `onPaid` runs once the
 * spend has landed, or at once where the action spends nothing.
 */

import { resolveEffectiveCrawlerLevel } from 'game-domain/crawlerLevel'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import {
  mechMaxEP,
  mechMaxHeat,
  pilotMaxAP,
  resolveChassisRef,
  resolveGauge,
  resolvePoolStart,
} from 'salvageunion-reference/rules'
import { changeUndoToast } from '../lib/changeUndoToast'
import { replacePartner } from '../lib/partnerLookup'
import type { PlayAction, PlayActionCompanion, PlayActionCurrency } from '../lib/rules/actionList'
import { activationPatch, pilotActivationPatch } from '../lib/rules/actionPatches'
import type { MechItemEconomy } from '../lib/rules/mechItems'
import { partnerDerivedStats, partnerTechLevel } from '../lib/rules/partnerStats'
import { runWrite } from '../lib/runWrite'
import { playCopy } from '../messages/play'
import { PLAY_TXN } from '../replica/provenance'
import type { PlayStore } from './play.model'

/** Whose numbers an activation reads and writes. */
export type ActivationUnits = {
  store: PlayStore
  pilot: Pilot | null | undefined
  /** The boarded mech; null on foot with none. */
  mech: Mech | null
  /** The pilot's crawler: its Tech Level raises max AP and a companion's maxima. */
  crawler: Crawler | null | undefined
}

/**
 * A companion as its host's record holds it now, with its EP and Heat maxima:
 * its actions spend its own EP, make its own Heat and tick its own Uses.
 */
export function companionNow(
  { store, pilot, crawler }: ActivationUnits,
  companion: PlayActionCompanion
) {
  const host =
    companion.host.kind === 'pilot'
      ? store.get('pilot', companion.host.id)
      : store.get('mech', companion.host.id)
  const partner = host?.partners?.find((p) => p.id === companion.id)
  if (!host || !partner) return null
  const techLevel = partnerTechLevel(
    partner,
    companion.host.kind === 'pilot' && pilot
      ? resolveEffectiveCrawlerLevel(pilot, crawler)
      : undefined
  )
  const max = partnerDerivedStats(partner, techLevel)
  return {
    host,
    partner,
    maxEP: max.energyPoints,
    heatCap: max.heatCapacity,
    currentHeat: resolveGauge(partner.currentHeat),
  }
}

/** Pay one activation of `action` in `currency`, spending `economy`. */
export function payActivation(
  units: ActivationUnits,
  action: PlayAction,
  currency: PlayActionCurrency,
  economy: MechItemEconomy,
  onPaid: () => void
): void {
  if (currency === 'AP') payPilot(units, action, economy, onPaid)
  else if (action.companion) payCompanion(units, action, action.companion, economy, onPaid)
  else payMech(units, action, economy, onPaid)
}

function payPilot(
  { store, pilot, crawler }: ActivationUnits,
  action: PlayAction,
  economy: MechItemEconomy,
  onPaid: () => void
) {
  if (!pilot) return
  const fresh = store.get('pilot', pilot.id) ?? pilot
  // An unrecorded live stat means UNSPENT, not empty: a pilot who has never
  // spent AP is at full AP. The stored value stays authoritative when
  // present: never clamp it here, since an unresolved ref makes the max 0.
  const before = resolvePoolStart(
    fresh.currentAP,
    pilotMaxAP({ ...fresh, crawlerTechLevel: resolveEffectiveCrawlerLevel(fresh, crawler) })
  )
  const patch = pilotActivationPatch({ apCost: economy.epCost, currentAP: before })
  if (Object.keys(patch).length === 0) {
    onPaid()
    return
  }
  // The resolve moves on to Roll only once the spend has landed.
  runWrite(() => store.update('pilot', pilot.id, patch, PLAY_TXN), onPaid)
  if (typeof patch.currentAP === 'number' && patch.currentAP !== before)
    changeUndoToast({
      id: `pilot:${pilot.id}:currentAP`,
      label: 'AP',
      did: playCopy('usedAction', { name: action.name }),
      from: before,
      to: patch.currentAP,
      undo: (value) =>
        runWrite(() => store.update('pilot', pilot.id, { currentAP: value }, PLAY_TXN)),
    })
}

function payCompanion(
  units: ActivationUnits,
  action: PlayAction,
  companion: PlayActionCompanion,
  economy: MechItemEconomy,
  onPaid: () => void
) {
  const now = companionNow(units, companion)
  if (!now) return
  const before = resolvePoolStart(now.partner.currentEP, now.maxEP)
  const patch = activationPatch({
    slug: action.slug,
    economy,
    currentEP: before,
    currentHeat: now.currentHeat,
    heatCap: now.heatCap,
    prevUses: now.partner.itemUses,
  })
  if (Object.keys(patch).length === 0) {
    onPaid()
    return
  }
  // Each write reads the host again, so a refund never drops a later change.
  const write = (fields: typeof patch) => {
    const fresh = companionNow(units, companion)
    if (!fresh) return Promise.resolve()
    const partners = replacePartner(fresh.host.partners, companion.id, fields)
    return companion.host.kind === 'pilot'
      ? units.store.update('pilot', companion.host.id, { partners }, PLAY_TXN)
      : units.store.update('mech', companion.host.id, { partners }, PLAY_TXN)
  }
  runWrite(() => write(patch), onPaid)
  if (typeof patch.currentEP === 'number' && patch.currentEP !== before)
    changeUndoToast({
      id: `partner:${companion.id}:currentEP`,
      label: `${companion.name} EP`,
      did: playCopy('usedAction', { name: action.name }),
      from: before,
      to: patch.currentEP,
      undo: (value) => runWrite(() => write({ currentEP: value })),
    })
}

function payMech(
  { store, mech }: ActivationUnits,
  action: PlayAction,
  economy: MechItemEconomy,
  onPaid: () => void
) {
  // EP is the mech's: only a boarded deck offers it.
  if (!mech) return
  const chassis = resolveChassisRef(mech.chassisRef)
  const fresh = store.get('mech', mech.id) ?? mech
  // Unrecorded EP means a mech that has never spent any: full, not empty.
  const before = resolvePoolStart(fresh.currentEP, mechMaxEP(fresh, chassis))
  const patch = activationPatch({
    slug: action.slug,
    economy,
    currentEP: before,
    currentHeat: resolveGauge(fresh.currentHeat),
    heatCap: mechMaxHeat(fresh, chassis),
    prevUses: fresh.itemUses,
  })
  if (Object.keys(patch).length === 0) {
    onPaid()
    return
  }
  runWrite(() => store.update('mech', mech.id, patch, PLAY_TXN), onPaid)
  if (typeof patch.currentEP === 'number' && patch.currentEP !== before)
    changeUndoToast({
      id: `mech:${mech.id}:currentEP`,
      label: 'EP',
      did: playCopy('usedAction', { name: action.name }),
      from: before,
      to: patch.currentEP,
      undo: (value) =>
        runWrite(() => store.update('mech', mech.id, { currentEP: value }, PLAY_TXN)),
    })
}
