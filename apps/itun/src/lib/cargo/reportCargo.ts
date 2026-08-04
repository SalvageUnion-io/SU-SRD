/**
 * reportCargo — the one place a cargo dispatch's refusal reaches the player.
 *
 * Every `useCargo` / `usePartnerCargo` action resolves to a
 * `CargoTransferResult`, and a refusal is data, not a throw: no crawler linked,
 * over the carrier's cap, a patch that failed its Zod parse, or a write the
 * connection mode blocked. `void`-ing the promise therefore leaves the player
 * staring at a button that silently did nothing — which is exactly what the
 * partner hold did while the mech/crawler Hold routed through a copy of this
 * helper that was private to `StorageManifest`.
 *
 * Disabled buttons pre-empt the *predictable* refusals (no crawler, hold full);
 * this exists for the ones that cannot be predicted at render time — a save
 * failure, or a second click landing after the first has already moved the lot.
 */

import { toast } from 'component-lib'

import type { CargoTransferResult } from './cargoTransfer'

/** Fire a cargo dispatch and surface its refusal reason as an error toast. */
export function reportCargo(pending: Promise<CargoTransferResult>): void {
  void pending.then((result) => {
    if (!result.ok) toast.error(result.reason)
  })
}
