/**
 * partnerLookup — the host-owned partner's write helper.
 *
 * A partner lives in an array ON its host (a pilot or a mech), not in a store of
 * its own: ownership is intrinsic, so deleting a host removes its partners and
 * they ride through snapshots with it.
 *
 * The by-id SCAN this module used to carry is gone along with the partner live
 * sheet (ADR-028). Nothing addresses a partner by a bare id any more — one
 * renders in place on its host's sheet, where the host is already in hand — so
 * all that remains is patching a single entry of a host's array.
 */

import type { Mech } from './schemas/mech'
import type { PartnerInstance } from './schemas/partner'
import type { Pilot } from './schemas/pilot'

/** A partner together with the host that owns it. */
export type PartnerWithHost =
  | { partner: PartnerInstance; hostKind: 'pilot'; host: Pilot }
  | { partner: PartnerInstance; hostKind: 'mech'; host: Mech }

/**
 * Replace one partner within its host's `partners` array.
 *
 * Returns the whole array so the caller can hand it straight to the store's
 * write-through `update`, which patches by field. Unmatched ids return the
 * array unchanged rather than appending — a write to a partner that no longer
 * exists is a no-op, not a resurrection.
 */
export function replacePartner(
  partners: readonly PartnerInstance[] | undefined,
  partnerId: string,
  patch: Partial<PartnerInstance>
): PartnerInstance[] {
  return (partners ?? []).map((p) => (p.id === partnerId ? { ...p, ...patch } : p))
}
