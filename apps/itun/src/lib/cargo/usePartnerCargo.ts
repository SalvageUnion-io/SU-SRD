/**
 * usePartnerCargo — the partner side of the carrier⇄depot cargo boundary.
 *
 * A sibling of `useCargo` rather than a branch inside it. Both wrap the same
 * pure `cargoTransfer` reducer and both persist through the entity store, but
 * they differ in the one place that is not shared: WHERE the carrier's lots get
 * written. A mech's live in its own store row (`mech.cargoLots`); a partner has
 * no row — it lives in an array on its host, so its lots persist as a patch to
 * `pilot.partners` / `mech.partners`. Folding that into `useCargo` would have
 * put a host-shaped branch through every one of its nine actions to serve one
 * differing line.
 *
 * Why partners are here at all: the Core Book's Load action reads "onto your
 * Mech or an allied Mech", and a partner "uses the same rules as Mechs", so a
 * partner is a cargo node rather than a leaf. It carries a real capacity —
 * Survey Drone 1, Mecha Companion 3, Sestra Drone 3.
 *
 * NOT modelled: carrier→carrier handoff (mech→partner, partner→partner). The
 * rules permit it; the reducer has one capped side and one unlimited side, so
 * both would need a target picker and an N-node reducer. The crawler Storage
 * Bay is the only depot today, which covers "drones can load things onto the
 * crawler" — the concrete case — and leaves the handoff visibly unbuilt rather
 * than half-built.
 */

import type { ChangeMeta } from '../../stores/entityStore'
import { useEntityStore } from '../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../stores/surfaceProvenance'
import type { PartnerWithHost } from '../partnerLookup'
import { replacePartner } from '../partnerLookup'
import { partnerDerivedStats } from '../rules/partnerStats'
import type { CargoLot } from '../schemas/cargoLot'
import type { Crawler } from '../schemas/crawler'
import type {
  CargoBoundaryState,
  CargoTransferAction,
  CargoTransferResult,
  CargoUsage,
} from './cargoTransfer'
import { cargoTransfer, carrierCargoUsage } from './cargoTransfer'

type UsePartnerCargoOptions = {
  found: PartnerWithHost
  /** The partner's effective tech level — drives its derived cargo capacity. */
  techLevel: number
  /** The depot side; null when the host has no crawler linked. */
  crawler?: Crawler | null
  store?: typeof useEntityStore
  readOnly?: boolean
  /** Change Log provenance for the writes this hook commits (ADR-022). */
  meta?: ChangeMeta
}

export type UsePartnerCargoResult = {
  state: CargoBoundaryState
  usage: CargoUsage
  /** Partner → crawler Storage Bay, whole lot. */
  stow: (lotId: string) => Promise<CargoTransferResult>
  /** Crawler Storage Bay → partner, cap-checked. */
  load: (lotId: string, qty?: number) => Promise<CargoTransferResult>
  /** Add a lot directly to the partner's hold. Needs no crawler. */
  addLot: (lot: CargoLot) => Promise<CargoTransferResult>
  /** Discard a lot from the partner's hold. Needs no crawler. */
  removeLot: (lotId: string) => Promise<CargoTransferResult>
}

export function usePartnerCargo({
  found,
  techLevel,
  crawler,
  store = useEntityStore,
  readOnly = false,
  meta = LIVE_SHEET_MANUAL,
}: UsePartnerCargoOptions): UsePartnerCargoResult {
  const { partner, hostKind, host } = found
  const storeState = store()

  const state: CargoBoundaryState = {
    carrierLots: partner.cargoLots ?? [],
    carrierCargoCap: partnerDerivedStats(partner, techLevel).cargoCapacity,
    depotLots: crawler?.cargoLots ?? [],
    scrapPool: crawler?.scrapPool ?? {},
  }

  async function dispatch(
    action: CargoTransferAction,
    /** Boundary actions need a crawler; hold-local ones do not. */
    needsDepot: boolean
  ): Promise<CargoTransferResult> {
    if (readOnly) return { ok: false, reason: 'This sheet is read-only.' }
    if (needsDepot && !crawler) {
      return {
        ok: false,
        reason: 'No crawler is linked — nothing to transfer to or from.',
      }
    }

    // Reduce against a FRESH read, not the render-time `state` snapshot — the
    // same guard `useCargo.dispatchMechLocal` carries. These are per-lot
    // buttons on a list, so two clicks can land before the store round-trip
    // re-renders; both would otherwise compute from the same base array and
    // the second write would resurrect the lot the first removed.
    //
    // The host is re-read too, not just the partner's lots: the patch below
    // rebuilds the WHOLE `partners` array, so a stale host would also revert
    // any concurrent edit to a sibling partner.
    const freshHost = storeState.get(hostKind, host.id) ?? host
    const freshPartner = (freshHost.partners ?? []).find((p) => p.id === partner.id) ?? partner
    const freshCrawler = crawler ? (storeState.get('crawler', crawler.id) ?? crawler) : null

    const result = cargoTransfer(
      {
        carrierLots: freshPartner.cargoLots ?? [],
        carrierCargoCap: partnerDerivedStats(freshPartner, techLevel).cargoCapacity,
        depotLots: freshCrawler?.cargoLots ?? [],
        scrapPool: freshCrawler?.scrapPool ?? {},
      },
      action
    )
    if (!result.ok) return result

    // Both sides commit in ONE IndexedDB transaction: a crash between two
    // sequential writes could vanish or duplicate the moved lot.
    const updates: Parameters<typeof storeState.transfer>[0]['updates'] = []
    if (result.changed.carrier) {
      updates.push({
        type: hostKind,
        id: host.id,
        // The partner's lots persist as a patch to its HOST's partners array —
        // the one thing that differs from useCargo.
        patch: {
          partners: replacePartner(freshHost.partners, partner.id, {
            cargoLots: result.state.carrierLots,
          }),
        },
      })
    }
    if (result.changed.depot && crawler) {
      updates.push({
        type: 'crawler',
        id: crawler.id,
        patch: { cargoLots: result.state.depotLots, scrapPool: result.state.scrapPool },
      })
    }
    if (updates.length === 0) return result

    try {
      await storeState.transfer({ updates }, meta)
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, reason: `Could not save that change: ${message}` }
    }
  }

  return {
    state,
    usage: carrierCargoUsage(state.carrierLots, state.carrierCargoCap),
    stow: (lotId) => dispatch({ type: 'stow', lotId }, true),
    load: (lotId, qty) => dispatch({ type: 'load', lotId, qty }, true),
    addLot: (lot) => dispatch({ type: 'add-carrier-lot', lot }, false),
    removeLot: (lotId) => dispatch({ type: 'remove-carrier-lot', lotId }, false),
  }
}
