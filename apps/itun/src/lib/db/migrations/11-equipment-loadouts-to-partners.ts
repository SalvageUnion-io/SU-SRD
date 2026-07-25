/**
 * v11 — `Pilot.equipmentLoadouts` → `Pilot.partners`.
 *
 * ADR-023 stored a drone/companion's installed loadout in a record keyed by
 * equipment SLUG. That worked while a pilot could only ever have one of each,
 * and broke the moment they could not: **Mecha Packmaster grants TWO Mecha
 * Companions** (Core Book p. 69), which shared a single loadout, a single name,
 * and a single condition set. ADR-023 called this an accepted limitation; it is
 * a live bug.
 *
 * Partners are now instances with their own ids, so this migration lifts each
 * `equipmentLoadouts[slug]` into one `PartnerInstance`, pulling identity across
 * from the parallel `equipmentChoices[slug]` map.
 *
 * WHAT IS DELIBERATELY NOT DONE HERE:
 *   - `equipmentLoadouts` is left in place rather than deleted. A migration is
 *     the one edit a user cannot undo, and leaving the old field costs a few
 *     bytes while making the change reversible from a pre-v11 export. Phase 5
 *     removes it once partners have shipped.
 *   - The equipment slug stays in `pilot.equipment[]`. The partner is the
 *     loadout, not the grant — the ability still grants the equipment.
 *   - Only pilots are touched. Mech-granted partners come from a chassis
 *     ability + pattern, so they are seeded when a mech is built, not migrated
 *     out of data that never existed.
 *
 * IMPORTANT: this runs inside the versionchange transaction, so it may only
 * await IndexedDB operations on `tx`. It reads no reference data — every input
 * (the loadout, the choices, the slug) already lives on the pilot record, and
 * `hostSchema` is the constant 'equipment' because `equipmentLoadouts` only
 * ever held pilot equipment.
 */

import { isRecord } from '../../isRecord'
import { STORE_NAMES } from '../stores'
import type { UpgradeTransaction } from './index'

/**
 * Choice names carrying a partner's identity, as they appear in
 * `equipmentChoices`. Free-text choices store their value as a single-element
 * array (see `ChoiceSelectionsSchema`).
 */
const NAME_KEYS = ['Name', 'name']
const APPEARANCE_KEYS = ['Appearance', 'appearance']
const PERSONALITY_KEYS = ['A.I. Personality', 'AI Personality', 'aiPersonality']

/** First non-empty single-value choice matching any of `keys`. */
function readChoice(choices: unknown, keys: readonly string[]): string | undefined {
  if (!isRecord(choices)) return undefined
  for (const key of keys) {
    const value = choices[key]
    if (typeof value === 'string' && value.trim() !== '') return value
    if (Array.isArray(value)) {
      const first = value.find((v) => typeof v === 'string' && v.trim() !== '')
      if (typeof first === 'string') return first
    }
  }
  return undefined
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/**
 * The pure record rewrite, exposed for unit testing (same shape as v6's
 * `normalizeRefsRecord`). Returns the partners array to attach, or `null` when
 * the record needs no rewrite — no loadouts, or partners already present.
 *
 * `mintId` is injected so tests get stable ids; production passes
 * `crypto.randomUUID`.
 */
export function partnersFromLoadouts(
  raw: unknown,
  mintId: () => string = () => crypto.randomUUID()
): Record<string, unknown>[] | null {
  if (!isRecord(raw)) return null
  if (!isRecord(raw.equipmentLoadouts)) return null
  // Idempotent: a record that already has partners is left alone, so a
  // re-run (or a partially-migrated import) never duplicates them.
  if (Array.isArray(raw.partners)) return null

  const choicesBySlug = isRecord(raw.equipmentChoices) ? raw.equipmentChoices : {}

  const partners = Object.entries(raw.equipmentLoadouts).flatMap(([slug, loadout]) => {
    if (!isRecord(loadout)) return []
    const choices = choicesBySlug[slug]
    const name = readChoice(choices, NAME_KEYS)
    const appearance = readChoice(choices, APPEARANCE_KEYS)
    const aiPersonality = readChoice(choices, PERSONALITY_KEYS)
    return [
      {
        // A fresh id per migrated loadout. The old shape held exactly one
        // loadout per slug, so this cannot un-merge a pair that was already
        // collapsed — it only stops future pairs from colliding.
        id: mintId(),
        hostRef: slug,
        hostSchema: 'equipment' as const,
        ...(name ? { name } : {}),
        ...(appearance ? { appearance } : {}),
        ...(aiPersonality ? { aiPersonality } : {}),
        systems: stringArray(loadout.systems),
        modules: stringArray(loadout.modules),
        ...(isRecord(loadout.systemConditions)
          ? { systemConditions: loadout.systemConditions }
          : {}),
        ...(isRecord(loadout.moduleConditions)
          ? { moduleConditions: loadout.moduleConditions }
          : {}),
        ...(isRecord(loadout.itemUses) ? { itemUses: loadout.itemUses } : {}),
        conditions: [],
      },
    ]
  })

  return partners.length > 0 ? partners : null
}

export async function migrate(tx: UpgradeTransaction): Promise<void> {
  if (!tx.db.objectStoreNames.contains(STORE_NAMES.pilots)) return

  let cursor = await tx.objectStore(STORE_NAMES.pilots).openCursor()
  while (cursor) {
    const raw = cursor.value as unknown
    const partners = partnersFromLoadouts(raw)
    if (partners) {
      await cursor.update({ ...(raw as Record<string, unknown>), partners })
    }
    cursor = await cursor.continue()
  }
}
