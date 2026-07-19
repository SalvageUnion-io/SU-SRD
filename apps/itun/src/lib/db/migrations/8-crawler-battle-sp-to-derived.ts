/**
 * v8 — crawler max SP goes derived-at-read (wizard-refresh Phase 5): the
 * chosen crawler TYPE's `max_sp_bonus` mutations (Battle +5) now apply inside
 * `crawlerMaxSP` at READ, so the stored record keeps the BARE tech-level
 * value and a type swap re-derives correctly in both directions.
 *
 * Before this, the Battle bonus was documented as hand-set into
 * `maxSpModifier` ("the Battle Crawler type's +5 Max SP lives here"). A
 * Battle crawler whose modifier still carries that hand-set bonus would now
 * DOUBLE-COUNT it (read-bonus + stored bonus), so this one-shot rewrite heals
 * Battle-typed records:
 *
 *   - `maxSpModifier >= 5`: the hand-set bonus is (contained in) the
 *     modifier — subtract exactly 5. This preserves the record's previous
 *     derived max to the point (old: base + mod; new: base + 5 + (mod − 5)),
 *     so nothing double-counts and hand-edits beyond the bonus survive.
 *     A resulting 0 removes the key (absent reads as 0).
 *   - `maxSpModifier` absent, 0, or < 5: the bonus was never (fully) applied
 *     — the record was STALE. Leave it untouched; the read path now grants
 *     the +5 the type always conferred (max SP rises, never falls, so no
 *     currentSP clamp is needed).
 *   - Non-Battle crawlers (and untyped/legacy records): untouched — no other
 *     type carries a `max_sp_bonus` mutation.
 *
 * The Battle type is matched by its SRD id OR name (stored `type` refs
 * resolve id-or-name, like bay refs). Both values are FROZEN SNAPSHOTS here,
 * not reference-data lookups: a migration may only await IndexedDB operations
 * on its versionchange transaction (awaiting a reference preload would let
 * the transaction auto-commit mid-migration), and a shipped migration must
 * describe the data as it was at ship time regardless of later catalog edits.
 *
 * IMPORTANT: this function runs inside the versionchange transaction. Only
 * IndexedDB operations on `tx` may be awaited.
 */

import type { UpgradeTransaction } from './index'
import { STORE_NAMES } from '../stores'

/** The Battle crawler type's SRD id + name at ship time (frozen snapshot). */
const BATTLE_TYPE_REFS: readonly string[] = ['3d1d9f79-9c56-43fa-a4c9-6dfe10b9aac9', 'Battle']

/** The Battle type's `max_sp_bonus` mutation value at ship time. */
const BATTLE_MAX_SP_BONUS = 5

/** Rewrite one crawler record; returns null when unchanged. */
export function normalizeCrawlerMaxSpRecord(
  raw: Record<string, unknown>
): Record<string, unknown> | null {
  if (typeof raw.type !== 'string' || !BATTLE_TYPE_REFS.includes(raw.type)) return null
  const modifier = raw.maxSpModifier
  if (typeof modifier !== 'number' || modifier < BATTLE_MAX_SP_BONUS) return null

  const next = { ...raw }
  const healed = modifier - BATTLE_MAX_SP_BONUS
  if (healed === 0) {
    delete next.maxSpModifier
  } else {
    next.maxSpModifier = healed
  }
  return next
}

export async function migrate(tx: UpgradeTransaction): Promise<void> {
  if (!tx.db.objectStoreNames.contains(STORE_NAMES.crawlers)) return
  let cursor = await tx.objectStore(STORE_NAMES.crawlers).openCursor()
  while (cursor) {
    const raw = cursor.value as unknown
    if (typeof raw === 'object' && raw !== null) {
      const next = normalizeCrawlerMaxSpRecord(raw as Record<string, unknown>)
      if (next) await cursor.update(next)
    }
    cursor = await cursor.continue()
  }
}
