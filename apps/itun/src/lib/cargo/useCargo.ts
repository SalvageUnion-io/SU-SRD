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

import type { ChangeMeta } from '../../stores/entityStore'
import { useEntityStore } from '../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../stores/surfaceProvenance'
import { mechMaxCargo } from '../rules/derivedStats'
import type { CargoLot } from '../schemas/cargoLot'
import type { Crawler } from '../schemas/crawler'
import type { Mech } from '../schemas/mech'
import {
  cargoTransfer,
  carrierCargoUsage,
  scrapPoolBucket,
  type CargoBoundaryState,
  type CargoTransferAction,
  type CargoTransferResult,
  type CargoUsage,
} from './cargoTransfer'

type UseCargoOptions = {
  /** The mech side of the boundary (null/undefined when no mech is docked). */
  mech?: Mech | null
  /**
   * The assigned pilot's ability refs. Beefcake raises the piloted MECH's Cargo
   * Capacity by 6 (ADR-029), so cargo capacity cannot be derived from the mech
   * alone. Absent = unlinked, which correctly contributes nothing.
   */
  pilotAbilities?: string[]
  /** The crawler side (null/undefined when no crawler is linked). */
  crawler?: Crawler | null
  /** Injectable store hook for testing; the real Zustand store otherwise. */
  store?: typeof useEntityStore
  /** When true every transfer refuses — read-only sheet contexts. */
  readOnly?: boolean
  /**
   * Change Log provenance for the writes this hook commits (ADR-022).
   *
   * Defaults to the Live Sheet's manual tag because that is where cargo is
   * moved by hand; a Dashboard-side caller should pass `DASHBOARD_TXN` so the
   * log distinguishes an enforced transaction from someone dragging a lot.
   */
  meta?: ChangeMeta
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
  /** Add a lot directly to the crawler Storage Bay. Needs a crawler, NOT a mech. */
  addCrawlerLot: (lot: CargoLot) => Promise<CargoTransferResult>
  /** Discard a lot from the crawler Storage Bay. Needs a crawler, NOT a mech. */
  removeCrawlerLot: (lotId: string) => Promise<CargoTransferResult>
}

/**
 * `storeState.transfer` REJECTS when a patch fails its Zod parse, so an awaited
 * call that is not guarded escapes as an unhandled rejection and the caller sees
 * nothing happen. Fold that into the ordinary refusal channel instead, so every
 * failure reaches the UI as an `{ ok: false, reason }` it already knows how to
 * report.
 */
async function commitUpdates(
  run: () => Promise<unknown>,
  result: CargoTransferResult
): Promise<CargoTransferResult> {
  try {
    await run()
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, reason: `Could not save that change: ${message}` }
  }
}

export function useCargo({
  pilotAbilities,
  mech,
  crawler,
  store = useEntityStore,
  readOnly = false,
  meta = LIVE_SHEET_MANUAL,
}: UseCargoOptions): UseCargoResult {
  const storeState = store()

  const state: CargoBoundaryState = {
    carrierLots: mech?.cargoLots ?? [],
    carrierCargoCap: mech ? mechMaxCargo(mech, undefined, { abilities: pilotAbilities }) : 0,
    depotLots: crawler?.cargoLots ?? [],
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
    if (result.changed.carrier) {
      updates.push({ type: 'mech', id: mech.id, patch: { cargoLots: result.state.carrierLots } })
    }
    if (result.changed.depot) {
      updates.push({
        type: 'crawler',
        id: crawler.id,
        patch: { cargoLots: result.state.depotLots, scrapPool: result.state.scrapPool },
      })
    }
    if (updates.length === 0) return result
    return commitUpdates(() => storeState.transfer({ updates }, meta), result)
  }

  // Mech-hold-local edits: the mech's own cargo hold is its own container, so
  // add/discard require only a docked mech — no crawler boundary. Persists the
  // mech side alone.
  async function dispatchMechLocal(action: CargoTransferAction): Promise<CargoTransferResult> {
    if (readOnly) return { ok: false, reason: 'This sheet is read-only.' }
    if (!mech) {
      return { ok: false, reason: 'No mech is docked — nothing to store cargo in.' }
    }

    // Reduce against a FRESH read, not the render-time `state` snapshot. These
    // are per-lot buttons on a list, so two clicks can land before the store
    // round-trip re-renders; both would otherwise compute from the same base
    // array and the second write would resurrect the lot the first removed.
    // Same fix the sheet controls already use (`freshEntity`).
    const freshMech = storeState.get('mech', mech.id) ?? mech
    const result = cargoTransfer(
      {
        ...state,
        carrierLots: freshMech.cargoLots ?? [],
        carrierCargoCap: mechMaxCargo(freshMech, undefined, { abilities: pilotAbilities }),
      },
      action
    )
    if (!result.ok) return result

    if (!result.changed.carrier) return result
    return commitUpdates(
      () =>
        storeState.transfer(
          {
            updates: [
              { type: 'mech', id: mech.id, patch: { cargoLots: result.state.carrierLots } },
            ],
          },
          meta
        ),
      result
    )
  }

  // Crawler-bay-local edits: the Storage Bay is its own container, so add/discard
  // require only a linked crawler — no docked mech. Persists the crawler side
  // alone, and only `cargoLots` (these actions never touch the scrap pool).
  async function dispatchCrawlerLocal(action: CargoTransferAction): Promise<CargoTransferResult> {
    if (readOnly) return { ok: false, reason: 'This sheet is read-only.' }
    if (!crawler) {
      return { ok: false, reason: 'No crawler is linked — nothing to store cargo in.' }
    }

    // Fresh read before reducing — see `dispatchMechLocal`. The Storage Bay's
    // per-lot Unstow has the same double-click hazard.
    const freshCrawler = storeState.get('crawler', crawler.id) ?? crawler
    const result = cargoTransfer(
      {
        ...state,
        depotLots: freshCrawler.cargoLots ?? [],
        scrapPool: freshCrawler.scrapPool ?? {},
      },
      action
    )
    if (!result.ok) return result

    if (!result.changed.depot) return result
    return commitUpdates(
      () =>
        storeState.transfer(
          {
            updates: [
              { type: 'crawler', id: crawler.id, patch: { cargoLots: result.state.depotLots } },
            ],
          },
          meta
        ),
      result
    )
  }

  return {
    state,
    usage: carrierCargoUsage(state.carrierLots, state.carrierCargoCap),
    poolBucket: (tl) => scrapPoolBucket(state.scrapPool, tl),
    stow: (lotId) => dispatch({ type: 'stow', lotId }),
    load: (lotId, qty) => dispatch({ type: 'load', lotId, qty }),
    withdrawScrap: (tl, qty) => dispatch({ type: 'withdraw-scrap', tl, qty }),
    addMechLot: (lot) => dispatchMechLocal({ type: 'add-carrier-lot', lot }),
    removeMechLot: (lotId) => dispatchMechLocal({ type: 'remove-carrier-lot', lotId }),
    addCrawlerLot: (lot) => dispatchCrawlerLocal({ type: 'add-depot-lot', lot }),
    removeCrawlerLot: (lotId) => dispatchCrawlerLocal({ type: 'remove-depot-lot', lotId }),
  }
}
