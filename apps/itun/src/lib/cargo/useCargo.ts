/**
 * useCargo — store-backed wrapper around the pure `cargoTransfer` reducer
 * (plan 4.1/4.7). Owns persistence only: state is derived from the passed
 * entities on every render, an action runs the reducer, and on success the
 * changed sides are written back through the entity store (mech `cargoLots`;
 * crawler `cargoLots` + `scrapPool`).
 *
 * The mech/crawler variant lanes consume this read-only — the reducer
 * semantics (whole-lot stow, cap-checked load, bulk split, scrap TL-bucket
 * round-trip) live in cargoTransfer.ts.
 */

import { useEntityStore } from '../../stores/entityStore'
import { mechMaxCargo } from '../rules/derivedStats'
import type { CargoLot } from '../schemas/cargoLot'
import type { Crawler } from '../schemas/crawler'
import type { Mech } from '../schemas/mech'
import {
  cargoTransfer,
  mechCargoUsage,
  scrapPoolBucket,
  type CargoBoundaryState,
  type CargoTransferAction,
  type CargoTransferResult,
  type CargoUsage,
} from './cargoTransfer'

type UseCargoOptions = {
  /** The mech side of the boundary (null/undefined when no mech is docked). */
  mech?: Mech | null
  /** The crawler side (null/undefined when no crawler is linked). */
  crawler?: Crawler | null
  /** Injectable store hook for testing; the real Zustand store otherwise. */
  store?: typeof useEntityStore
  /** When true every transfer refuses — read-only sheet contexts. */
  readOnly?: boolean
}

export type UseCargoResult = {
  state: CargoBoundaryState
  /** Mech hold usage (used/cap/free/over). `over` renders honest red pips. */
  usage: CargoUsage
  /** Read a crawler scrap-pool TL bucket (absent buckets read as 0). */
  poolBucket: (tl: number) => number
  /** Mech → crawler, whole lot. SCRAP lots deposit the TL pool bucket. */
  stow: (lotId: string) => Promise<CargoTransferResult>
  /** Crawler → mech, cap-checked; bulk lots split and mint a new lot. */
  load: (lotId: string, qty?: number) => Promise<CargoTransferResult>
  /** Pool → mech as a bulk SCRAP lot (merges into a same-TL lot). */
  withdrawScrap: (tl: number, qty: number) => Promise<CargoTransferResult>
  /** Add a lot directly to the mech hold. Needs a mech, NOT a crawler. */
  addMechLot: (lot: CargoLot) => Promise<CargoTransferResult>
  /** Discard a lot from the mech hold. Needs a mech, NOT a crawler. */
  removeMechLot: (lotId: string) => Promise<CargoTransferResult>
}

export function useCargo({
  mech,
  crawler,
  store = useEntityStore,
  readOnly = false,
}: UseCargoOptions): UseCargoResult {
  const storeState = store()

  const state: CargoBoundaryState = {
    mechLots: mech?.cargoLots ?? [],
    mechCargoCap: mech ? mechMaxCargo(mech) : 0,
    crawlerLots: crawler?.cargoLots ?? [],
    scrapPool: crawler?.scrapPool ?? {},
  }

  async function dispatch(action: CargoTransferAction): Promise<CargoTransferResult> {
    if (readOnly) return { ok: false, reason: 'This sheet is read-only.' }
    if (!mech)
      return {
        ok: false,
        reason: 'No mech is docked — nothing to transfer to or from.',
      }
    if (!crawler) {
      return {
        ok: false,
        reason: 'No crawler is linked — nothing to transfer to or from.',
      }
    }

    const result = cargoTransfer(state, action)
    if (!result.ok) return result

    // Both sides of the boundary commit in ONE IDB transaction — a crash
    // between two sequential writes could otherwise vanish or duplicate the
    // moved lot (audit item 2).
    const updates: Parameters<typeof storeState.transfer>[0]['updates'] = []
    if (result.changed.mech) {
      updates.push({ type: 'mech', id: mech.id, patch: { cargoLots: result.state.mechLots } })
    }
    if (result.changed.crawler) {
      updates.push({
        type: 'crawler',
        id: crawler.id,
        patch: { cargoLots: result.state.crawlerLots, scrapPool: result.state.scrapPool },
      })
    }
    if (updates.length > 0) await storeState.transfer({ updates })
    return result
  }

  // Mech-hold-local edits: the mech's own cargo hold is its own container, so
  // add/discard require only a docked mech — no crawler boundary. Persists the
  // mech side alone.
  async function dispatchMechLocal(action: CargoTransferAction): Promise<CargoTransferResult> {
    if (readOnly) return { ok: false, reason: 'This sheet is read-only.' }
    if (!mech) {
      return { ok: false, reason: 'No mech is docked — nothing to store cargo in.' }
    }

    const result = cargoTransfer(state, action)
    if (!result.ok) return result

    if (result.changed.mech) {
      await storeState.transfer({
        updates: [{ type: 'mech', id: mech.id, patch: { cargoLots: result.state.mechLots } }],
      })
    }
    return result
  }

  return {
    state,
    usage: mechCargoUsage(state.mechLots, state.mechCargoCap),
    poolBucket: (tl) => scrapPoolBucket(state.scrapPool, tl),
    stow: (lotId) => dispatch({ type: 'stow', lotId }),
    load: (lotId, qty) => dispatch({ type: 'load', lotId, qty }),
    withdrawScrap: (tl, qty) => dispatch({ type: 'withdraw-scrap', tl, qty }),
    addMechLot: (lot) => dispatchMechLocal({ type: 'add-mech-lot', lot }),
    removeMechLot: (lotId) => dispatchMechLocal({ type: 'remove-mech-lot', lotId }),
  }
}
