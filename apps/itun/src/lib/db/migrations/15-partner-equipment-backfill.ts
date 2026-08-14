/**
 * v15 — a pilot partner's granting equipment slug must be IN `pilot.equipment`.
 *
 * ── The invariant, and why it only now matters ───────────────────────────────
 *
 * A partner is a projection of its grant: it is created when the grant appears
 * and reaped when the grant goes (`lib/rules/partnerGrants.ts`). For a pilot the
 * grant is membership in `pilot.equipment` — so a partner whose `hostRef` is
 * absent from that array answers to no grant at all, and reconciliation reaps
 * it on the owner's next edit.
 *
 * Until reconciliation existed, nothing read the relationship and the breach was
 * invisible. It is not invisible now, and it is not hypothetical:
 *
 *   - **v11** (`equipmentLoadouts` → partners) is clean. Its own header says so:
 *     "The equipment slug stays in `pilot.equipment[]`. The partner is the
 *     loadout, not the grant." A loadout only existed because the item was
 *     equipped.
 *   - **v12** (companion-mechs → partners) is not. It minted partners from mech
 *     rows whose `chassisRef` held an equipment slug, and never touched
 *     `pilot.equipment` — a companion wearing a mech costume is precisely the
 *     case where the player did NOT also equip the item. Eldridge Coast shipped
 *     four such rows (Custos, Incitatus, PR-1, Rek Jet).
 *
 * So this backfills the missing slug rather than deleting the partner. The
 * partner is the evidence: a `PartnerInstance` exists only because something
 * once granted it, and the honest repair is to restore the grant the earlier
 * migration dropped, not to destroy what it created.
 *
 * ── What it deliberately does NOT do ─────────────────────────────────────────
 *
 * It never removes a slug, never touches mech-hosted partners (their grant is a
 * chassis ability, not an equipment array), and never mints a partner. It only
 * ever appends, so running it against an already-consistent database is a no-op.
 *
 * One honest cost: granting equipment occupies an inventory slot, so a healed
 * pilot's inventory usage goes up by one per backfilled partner and may show as
 * over capacity. That is advisory, never blocking (ADR-007/021), and it is the
 * true reading — a v11-migrated pilot with the same companion has always paid
 * that slot. Under-reporting it was the bug, not the fix.
 *
 * IMPORTANT: versionchange semantics — only IndexedDB operations on `tx` may be
 * awaited here. Reference data is NOT loadable, which is why the granting slugs
 * are hardcoded (identically to v12) rather than derived from `equipment.json`.
 */

import { isRecord } from '../../isRecord'
import { STORE_NAMES } from '../stores'
import type { UpgradeTransaction } from './types'

/**
 * The `equipment` records carrying a mech-shaped stat block — the only slugs a
 * pilot-hosted partner can legitimately answer to. Hardcoded for the same reason
 * v12 hardcodes them: a migration runs inside a versionchange transaction and
 * may only await IndexedDB, so it cannot ask the ORM.
 */
const PARTNER_EQUIPMENT_SLUGS = new Set(['auto-turret', 'survey-drone', 'mecha-companion'])

/**
 * The slugs missing from `equipment` that this pilot's partners require.
 * Pure, exposed for tests. Returns [] when nothing is missing.
 */
export function missingGrantSlugs(pilot: Record<string, unknown>): string[] {
  const partners = Array.isArray(pilot.partners) ? pilot.partners : []
  const equipment = Array.isArray(pilot.equipment)
    ? pilot.equipment.filter((e): e is string => typeof e === 'string')
    : []
  const held = new Set(equipment)

  const missing = new Set<string>()
  for (const partner of partners) {
    if (!isRecord(partner)) continue
    // Mech-hosted partners never appear on a pilot, but `hostSchema` is the
    // disambiguator everywhere else in this codebase and skipping the check
    // here would be the one place that assumed instead of asking.
    if (partner.hostSchema !== 'equipment') continue
    const ref = partner.hostRef
    if (typeof ref !== 'string') continue
    if (!PARTNER_EQUIPMENT_SLUGS.has(ref)) continue
    if (held.has(ref)) continue
    missing.add(ref)
  }
  return [...missing]
}

export async function migrate(tx: UpgradeTransaction): Promise<void> {
  const { db } = tx
  if (!db.objectStoreNames.contains(STORE_NAMES.pilots)) return

  const pilotStore = tx.objectStore(STORE_NAMES.pilots)
  const pilots = (await pilotStore.getAll()) as Record<string, unknown>[]

  for (const pilot of pilots) {
    const missing = missingGrantSlugs(pilot)
    if (missing.length === 0) continue
    const equipment = Array.isArray(pilot.equipment)
      ? pilot.equipment.filter((e): e is string => typeof e === 'string')
      : []
    await pilotStore.put({ ...pilot, equipment: [...equipment, ...missing] })
  }
}
