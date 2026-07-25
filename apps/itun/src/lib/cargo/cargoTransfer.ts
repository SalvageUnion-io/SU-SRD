/**
 * cargoTransfer — the single pure reducer for cargo crossing the CARRIER⇄DEPOT
 * boundary (design §2.12, plan 4.1/4.7). The prototype's nested-setState
 * transfer logic is reimplemented here as one reducer over both lot lists plus
 * the depot scrap pool; `useCargo` wraps it and persists through the stores.
 *
 * CARRIER and DEPOT, not "mech" and "crawler". The two sides are a *capped*
 * hold and an *unlimited* one, and nothing in the arithmetic below cares which
 * entity owns either. That mattered once partners arrived: a partner "uses the
 * same rules as Mechs" (Core Book, at all four partner entries) and carries a
 * real `cargoCapacity` — Survey Drone 1, Mecha Companion 3, Sestra Drone 3 — so
 * it is a capped carrier in exactly the sense this reducer already meant. The
 * fields were renamed rather than the partner being passed through a field
 * called `mechLots`, which would have been a lie that outlived whoever wrote it.
 *
 * (The crawler Storage Bay remains the only depot; the book's Load action also
 * permits carrier→carrier handoff, which this reducer does not yet model.)
 *
 * Transfer rules:
 * - **Stow (carrier → depot):** always whole-lot (the depot hold is
 *   unlimited); the lot is prepended to the depot list.
 * - **Load (depot → carrier):** cap-checked against the carrier's free slots.
 *   Unit lots move whole-or-not. Bulk lots split: the moved portion mints a
 *   NEW lot (fresh id) on the carrier and the source is decremented or removed.
 * - **Over-capacity is enforced on inbound transfers only** — existing
 *   over-capacity is displayed honestly (red pips), never clamped away.
 *
 * Scrap (rules-major, S7/[rules C5, §12]): SCRAP-cat lots crossing the
 * crawler boundary deposit/withdraw the matching TL pool bucket —
 * - Stowing a SCRAP lot converts it INTO the pool (`scrapPool.tl{n} += qty`);
 *   it does not appear as a crawler cargo lot.
 * - `withdraw-scrap` moves pool scrap back onto the mech as a bulk SCRAP lot
 *   (1 slot per scrap), merging into an existing same-TL bulk lot when one
 *   exists. The withdrawn quantity clamps to both the bucket and the mech's
 *   free slots (partial-fill 'Load N' semantics).
 * - A stray SCRAP lot sitting in the crawler HOLD (legacy/imported data only
 *   — stow never creates one) loads like any other lot, with no pool
 *   interaction: it never entered the pool, so nothing is withdrawn.
 */

import type { CargoLot } from '../schemas/cargoLot'
import { makeScrapLot, totalLotUnits } from '../schemas/cargoLot'
import type { ScrapPool } from '../schemas/crawler'

export type CargoBoundaryState = {
  /** Lots in the carrier's hold — a mech's, or a partner's. */
  carrierLots: CargoLot[]
  /** Carrier cargo capacity (derived: chassis/stat-block stat + modifier). */
  carrierCargoCap: number
  /** Lots in the depot hold (the crawler Storage Bay — unlimited). */
  depotLots: CargoLot[]
  /** The depot's shared TL-bucketed scrap pool. */
  scrapPool: ScrapPool
}

export type CargoTransferAction =
  | { type: 'stow'; lotId: string }
  | { type: 'load'; lotId: string; qty?: number }
  | { type: 'withdraw-scrap'; tl: number; qty: number }
  // Mech-hold-local edits — NO crawler required. A mech's cargo hold is its own
  // container (distinct from the crawler's Storage Bay), so cargo can be added
  // to / discarded from it whether or not a crawler is linked.
  | { type: 'add-carrier-lot'; lot: CargoLot }
  | { type: 'remove-carrier-lot'; lotId: string }
  // Crawler-bay-local edits — NO docked mech required. The Storage Bay is its
  // own container too, so cargo can be added to / discarded from it whether or
  // not a mech is docked.
  | { type: 'add-depot-lot'; lot: CargoLot }
  | { type: 'remove-depot-lot'; lotId: string }

export type CargoTransferOk = {
  ok: true
  state: CargoBoundaryState
  /** Which sides changed — lets the persistence layer write only what moved. */
  changed: { carrier: boolean; depot: boolean }
  /** Quantity actually moved (bulk loads / scrap withdrawals may be partial). */
  moved?: number
}

export type CargoTransferError = { ok: false; reason: string }

export type CargoTransferResult = CargoTransferOk | CargoTransferError

/** Carrier hold usage. `over` is display truth — over-capacity is never clamped. */
export type CargoUsage = {
  used: number
  cap: number
  /** Free inbound slots (floored at 0). */
  free: number
  over: boolean
}

export function carrierCargoUsage(
  lots: ReadonlyArray<Pick<CargoLot, 'units'>>,
  cap: number
): CargoUsage {
  const used = totalLotUnits(lots)
  return { used, cap, free: Math.max(0, cap - used), over: used > cap }
}

type ScrapTlKey = 'tl1' | 'tl2' | 'tl3' | 'tl4' | 'tl5' | 'tl6'

function scrapTlKey(tl: number): ScrapTlKey | null {
  return Number.isInteger(tl) && tl >= 1 && tl <= 6 ? (`tl${tl}` as ScrapTlKey) : null
}

/** Read a TL bucket from the pool. Absent buckets read as 0 (schema contract). */
export function scrapPoolBucket(pool: ScrapPool, tl: number): number {
  const key = scrapTlKey(tl)
  return key === null ? 0 : (pool[key] ?? 0)
}

/** Return a new pool with `delta` applied to the TL bucket (floored at 0). */
export function addToScrapPool(pool: ScrapPool, tl: number, delta: number): ScrapPool {
  const key = scrapTlKey(tl)
  if (key === null) return pool
  return { ...pool, [key]: Math.max(0, (pool[key] ?? 0) + delta) }
}

/**
 * The scrap quantity a SCRAP lot carries. Bulk scrap lots store it in `qty`
 * (= `units`: 1 slot per scrap on a mech); unit lots fall back to `units`.
 */
function scrapQtyOf(lot: CargoLot): number {
  return lot.qty ?? lot.units
}

/** Per-item slot cost of a bulk lot (≥1; non-bulk lots cost their full units). */
function perUnitCost(lot: CargoLot): number {
  if (lot.kind !== 'bulk' || lot.qty === undefined || lot.qty <= 0) return lot.units
  return Math.max(1, Math.round(lot.units / lot.qty))
}

/**
 * The single reducer over both holds + the scrap pool. Pure: returns a new
 * state (sharing unchanged arrays) or a refusal with an honest reason — it
 * never throws and never mutates its input.
 */
export function cargoTransfer(
  state: CargoBoundaryState,
  action: CargoTransferAction
): CargoTransferResult {
  switch (action.type) {
    case 'stow':
      return stow(state, action.lotId)
    case 'load':
      return load(state, action.lotId, action.qty)
    case 'withdraw-scrap':
      return withdrawScrap(state, action.tl, action.qty)
    case 'add-carrier-lot':
      return addCarrierLot(state, action.lot)
    case 'remove-carrier-lot':
      return removeCarrierLot(state, action.lotId)
    case 'add-depot-lot':
      return addDepotLot(state, action.lot)
    case 'remove-depot-lot':
      return removeDepotLot(state, action.lotId)
  }
}

/**
 * Add a lot directly to the mech hold (no crawler boundary). Over-capacity is
 * NOT enforced here — the hold displays overflow honestly (red pips); manual
 * hold entries are record-keeping, matching how wizard/pattern cargo can seed a
 * hold above cap. Prepended so the newest lot reads first, mirroring load/stow.
 */
function addCarrierLot(state: CargoBoundaryState, lot: CargoLot): CargoTransferResult {
  return {
    ok: true,
    state: { ...state, carrierLots: [lot, ...state.carrierLots] },
    changed: { carrier: true, depot: false },
  }
}

/** Remove (discard) a lot from the mech hold entirely — no crawler required. */
function removeCarrierLot(state: CargoBoundaryState, lotId: string): CargoTransferResult {
  if (!state.carrierLots.some((l) => l.id === lotId)) {
    return { ok: false, reason: `Cargo lot "${lotId}" is not in the mech hold.` }
  }
  return {
    ok: true,
    state: { ...state, carrierLots: state.carrierLots.filter((l) => l.id !== lotId) },
    changed: { carrier: true, depot: false },
  }
}

/**
 * Add a lot directly to the crawler's Storage Bay (no mech boundary). The bay is
 * unlimited, so there is no cap check. Prepended, mirroring stow/load ordering.
 */
function addDepotLot(state: CargoBoundaryState, lot: CargoLot): CargoTransferResult {
  return {
    ok: true,
    state: { ...state, depotLots: [lot, ...state.depotLots] },
    changed: { carrier: false, depot: true },
  }
}

/** Remove (discard) a lot from the crawler's Storage Bay — no mech required. */
function removeDepotLot(state: CargoBoundaryState, lotId: string): CargoTransferResult {
  if (!state.depotLots.some((l) => l.id === lotId)) {
    return { ok: false, reason: `Cargo lot "${lotId}" is not in the crawler Storage Bay.` }
  }
  return {
    ok: true,
    state: { ...state, depotLots: state.depotLots.filter((l) => l.id !== lotId) },
    changed: { carrier: false, depot: true },
  }
}

function stow(state: CargoBoundaryState, lotId: string): CargoTransferResult {
  const lot = state.carrierLots.find((l) => l.id === lotId)
  if (!lot)
    return {
      ok: false,
      reason: `Cargo lot "${lotId}" is not in the mech hold.`,
    }

  const carrierLots = state.carrierLots.filter((l) => l.id !== lotId)

  // SCRAP crossing INTO the crawler deposits the matching TL pool bucket.
  if (lot.cat === 'SCRAP' && lot.tl !== undefined) {
    return {
      ok: true,
      state: {
        ...state,
        carrierLots,
        scrapPool: addToScrapPool(state.scrapPool, lot.tl, scrapQtyOf(lot)),
      },
      changed: { carrier: true, depot: true },
      moved: scrapQtyOf(lot),
    }
  }

  return {
    ok: true,
    state: { ...state, carrierLots, depotLots: [lot, ...state.depotLots] },
    changed: { carrier: true, depot: true },
  }
}

function load(
  state: CargoBoundaryState,
  lotId: string,
  requestedQty?: number
): CargoTransferResult {
  const lot = state.depotLots.find((l) => l.id === lotId)
  if (!lot)
    return {
      ok: false,
      reason: `Cargo lot "${lotId}" is not in the crawler hold.`,
    }

  const { free } = carrierCargoUsage(state.carrierLots, state.carrierCargoCap)
  if (free <= 0) return { ok: false, reason: 'The mech hold has no free cargo slots.' }

  // Unit lots move whole-or-not.
  if (lot.kind === 'unit' || lot.qty === undefined) {
    if (lot.units > free) {
      return {
        ok: false,
        reason: `"${lot.name}" needs ${lot.units} slots but only ${free} are free.`,
      }
    }
    return {
      ok: true,
      state: {
        ...state,
        carrierLots: [lot, ...state.carrierLots],
        depotLots: state.depotLots.filter((l) => l.id !== lotId),
      },
      changed: { carrier: true, depot: true },
    }
  }

  // Bulk lots split: move = min(requested, lot qty, what fits).
  const per = perUnitCost(lot)
  const fits = Math.floor(free / per)
  const moveQty = Math.min(requestedQty ?? lot.qty, lot.qty, fits)
  if (moveQty <= 0) {
    return {
      ok: false,
      reason: `"${lot.name}" needs ${per} slots per unit but only ${free} are free.`,
    }
  }

  const movedUnits = moveQty * per
  const minted: CargoLot = {
    ...lot,
    id: crypto.randomUUID(),
    qty: moveQty,
    units: movedUnits,
  }
  const remainingQty = lot.qty - moveQty
  const depotLots =
    remainingQty <= 0
      ? state.depotLots.filter((l) => l.id !== lotId)
      : state.depotLots.map((l) =>
          l.id === lotId ? { ...l, qty: remainingQty, units: l.units - movedUnits } : l
        )

  return {
    ok: true,
    state: { ...state, carrierLots: [minted, ...state.carrierLots], depotLots },
    changed: { carrier: true, depot: true },
    moved: moveQty,
  }
}

function withdrawScrap(state: CargoBoundaryState, tl: number, qty: number): CargoTransferResult {
  if (scrapTlKey(tl) === null) {
    return { ok: false, reason: `"${tl}" is not a scrap tech level (1–6).` }
  }
  if (qty <= 0) return { ok: false, reason: 'Nothing to withdraw.' }

  const available = scrapPoolBucket(state.scrapPool, tl)
  if (available <= 0) {
    return { ok: false, reason: `The Tech ${tl} scrap bucket is empty.` }
  }

  const { free } = carrierCargoUsage(state.carrierLots, state.carrierCargoCap)
  if (free <= 0) return { ok: false, reason: 'The mech hold has no free cargo slots.' }

  // 1 slot per scrap — partial-fill to whatever both the bucket and cap allow.
  const moveQty = Math.min(qty, available, free)

  // Merge into an existing same-TL bulk SCRAP lot so repeated withdrawals
  // don't proliferate lots; mint a fresh one otherwise.
  const existing = state.carrierLots.find(
    (l) => l.cat === 'SCRAP' && l.kind === 'bulk' && l.tl === tl
  )
  const carrierLots = existing
    ? state.carrierLots.map((l) =>
        l.id === existing.id ? { ...l, qty: (l.qty ?? 0) + moveQty, units: l.units + moveQty } : l
      )
    : [makeScrapLot(tl, moveQty), ...state.carrierLots]

  return {
    ok: true,
    state: {
      ...state,
      carrierLots,
      scrapPool: addToScrapPool(state.scrapPool, tl, -moveQty),
    },
    changed: { carrier: true, depot: true },
    moved: moveQty,
  }
}
