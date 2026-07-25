/**
 * partnerLookup — resolve a partner by its flat id across every possible host.
 *
 * A partner lives in an array ON its host (a pilot or a mech), not in a store of
 * its own — ownership is intrinsic, so deleting a host removes its partners and
 * they ride through snapshots with it. The cost of that choice is exactly this
 * module: `/sheet/partner/:id` carries only the partner's id, so finding it
 * means scanning both host collections.
 *
 * That scan is deliberate rather than a shortcut around a missing index. The
 * alternative — making a partner a fourth entity store — buys O(1) lookup and
 * pays for it with orphaned partners whenever a host is deleted, a widened
 * `EntityRef` rippling into SoftLink / snapshots / export bundles, and a roster
 * citizen that must then be special-cased OUT of every listing. A linear pass
 * over one browser's builds is not a cost worth that.
 */

import type { Mech } from './schemas/mech'
import type { PartnerInstance } from './schemas/partner'
import type { Pilot } from './schemas/pilot'

/** A partner together with the host that owns it. */
export type PartnerWithHost =
  | { partner: PartnerInstance; hostKind: 'pilot'; host: Pilot }
  | { partner: PartnerInstance; hostKind: 'mech'; host: Mech }

/**
 * Find a partner by id across all pilots and mechs.
 *
 * Returns the host alongside it because nothing useful can be done with a
 * partner in isolation: writing to it means patching its host's `partners`
 * array, and rendering it means showing where it belongs. Returns null when no
 * host claims the id — a partner whose host was deleted simply ceases to exist,
 * which is the intended semantics.
 */
export function findPartner(
  pilots: readonly Pilot[],
  mechs: readonly Mech[],
  partnerId: string
): PartnerWithHost | null {
  for (const host of pilots) {
    const partner = host.partners?.find((p) => p.id === partnerId)
    if (partner) return { partner, hostKind: 'pilot', host }
  }
  for (const host of mechs) {
    const partner = host.partners?.find((p) => p.id === partnerId)
    if (partner) return { partner, hostKind: 'mech', host }
  }
  return null
}

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
