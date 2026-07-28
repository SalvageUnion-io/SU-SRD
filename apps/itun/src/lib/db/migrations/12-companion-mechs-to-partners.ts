/**
 * v12 — companion-mechs → partners, and the Gladhand retirement.
 *
 * ── Part 1: mechs that were never mechs ──────────────────────────────────────
 *
 * The Eldridge Coast workspace originally seeded TEN mech rows, four of which
 * were companions wearing a mech costume with an *equipment* slug jammed into
 * `chassisRef`:
 *
 *   eldridge-mech-custos     chassisRef 'survey-drone'
 *   eldridge-mech-incitatus  chassisRef 'mecha-companion'
 *   eldridge-mech-pr-1       chassisRef 'survey-drone'
 *   eldridge-mech-rek-jet    chassisRef 'auto-turret'
 *
 * None of those slugs resolves against `chassis.json`, so each rendered as a
 * mech with an unknown chassis and no stats. The SEED was corrected long ago,
 * but the seeder is guarded on the workspace's existence — it never rewrites a
 * workspace it already spawned — so every browser that opened Eldridge Coast
 * before that fix still holds these four rows, and no migration has ever
 * reached them. v11 only converted `equipmentLoadouts`, which these predate.
 *
 * The rule this implements is the general one: **a mech whose chassis is not a
 * chassis belongs somewhere else.** Where "somewhere else" is knowable it is
 * knowable exactly — the three `equipment` records carrying a mech-shaped stat
 * block are the entire set of pilot-granted partners in the game. They are
 * hardcoded rather than derived because a migration runs inside a versionchange
 * transaction and may only await IndexedDB: it cannot load reference data to
 * ask whether a slug resolves.
 *
 * A mech whose `chassisRef` is invalid but NOT one of these is deliberately
 * left alone. We would be guessing at where it belongs, and a migration is the
 * one edit a user cannot undo — an unknown-chassis mech is visible and fixable,
 * a silently deleted one is not.
 *
 * The conversion is lossless where the shapes meet: name, systems, modules,
 * per-item conditions, uses, current SP/heat and appearance all carry over.
 * `quirk` has no partner counterpart and lands in `aiPersonality`, which is
 * what it was being used for ("Changes personality frequently" on Rek Jet).
 * `patternName` is dropped: a partner has no chassis and therefore no pattern.
 *
 * ── Part 2: Gladhand ─────────────────────────────────────────────────────────
 *
 * The Eldridge Coast roster is one crawler now. Gladhand is deleted and any
 * pilot still crewing it is repointed at Haven, so nobody is left linked to a
 * row that no longer exists.
 *
 * IMPORTANT: versionchange semantics — only IndexedDB operations on `tx` may be
 * awaited here. Every input is already on the records being read.
 */

import { isRecord } from '../../isRecord'
import { STORE_NAMES } from '../stores'
import type { UpgradeTransaction } from './index'

/**
 * The `equipment` records that carry a mech-shaped stat block, i.e. the only
 * slugs for which "this mech is really a partner" is a fact rather than a
 * guess. See `equipment.json` — these three are the only entries with
 * `systemSlots`/`energyPoints`/`bonusPerTechLevel`.
 */
const PARTNER_EQUIPMENT_SLUGS = new Set(['auto-turret', 'survey-drone', 'mecha-companion'])

/** Eldridge Coast's retired second crawler, and the one every pilot moves to. */
const GLADHAND_ID = 'eldridge-crawler-gladhand'
const HAVEN_ID = 'eldridge-crawler-haven'

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

/**
 * Whether this mech record is really a partner. Exposed for tests.
 *
 * Note the asymmetry with the doc above: this returns false for a mech with a
 * merely *unrecognised* chassis. Only a chassis slug that is positively known
 * to be a partner stat block converts.
 */
export function isCompanionMech(raw: unknown): boolean {
  return (
    isRecord(raw) &&
    typeof raw.chassisRef === 'string' &&
    PARTNER_EQUIPMENT_SLUGS.has(raw.chassisRef)
  )
}

/**
 * Build the `PartnerInstance` a companion-mech becomes. Pure, exposed for
 * tests; `mintId` is injected so tests get stable ids.
 */
export function partnerFromCompanionMech(
  raw: Record<string, unknown>,
  mintId: () => string = () => crypto.randomUUID()
): Record<string, unknown> {
  const name = nonEmptyString(raw.name)
  const appearance = nonEmptyString(raw.appearance)
  // `quirk` is where the old shape stored what is now A.I. personality — a
  // mech's quirk field was the only free-text slot a companion-mech had.
  const quirk = nonEmptyString(raw.quirk)

  return {
    id: mintId(),
    hostRef: raw.chassisRef as string,
    hostSchema: 'equipment' as const,
    ...(name ? { name } : {}),
    ...(appearance ? { appearance } : {}),
    ...(quirk ? { aiPersonality: quirk } : {}),
    ...(typeof raw.currentSP === 'number' ? { currentSP: raw.currentSP } : {}),
    ...(typeof raw.currentEP === 'number' ? { currentEP: raw.currentEP } : {}),
    ...(typeof raw.currentHeat === 'number' ? { currentHeat: raw.currentHeat } : {}),
    systems: stringArray(raw.systems),
    modules: stringArray(raw.modules),
    ...(isRecord(raw.systemConditions) ? { systemConditions: raw.systemConditions } : {}),
    ...(isRecord(raw.moduleConditions) ? { moduleConditions: raw.moduleConditions } : {}),
    ...(isRecord(raw.itemUses) ? { itemUses: raw.itemUses } : {}),
    ...(Array.isArray(raw.cargoLots) ? { cargoLots: raw.cargoLots } : {}),
    conditions: [],
  }
}

export async function migrate(tx: UpgradeTransaction): Promise<void> {
  const { db } = tx
  const has = (name: string) => db.objectStoreNames.contains(name)
  if (!has(STORE_NAMES.mechs) || !has(STORE_NAMES.pilots) || !has(STORE_NAMES.softLinks)) return

  const softLinkStore = tx.objectStore(STORE_NAMES.softLinks)
  const allLinks = (await softLinkStore.getAll()) as Record<string, unknown>[]

  // ── Part 1 ────────────────────────────────────────────────────────────────
  const mechStore = tx.objectStore(STORE_NAMES.mechs)
  const pilotStore = tx.objectStore(STORE_NAMES.pilots)
  const companions = ((await mechStore.getAll()) as unknown[]).filter(isCompanionMech) as Record<
    string,
    unknown
  >[]

  for (const mech of companions) {
    const mechId = mech.id as string
    // The owning pilot is whoever this mech is assigned to. Without a link
    // there is no host to attach to, so the row is left as-is rather than
    // orphaning a partner or picking an arbitrary pilot.
    const link = allLinks.find(
      (l) =>
        l.type === 'mech-to-pilot' &&
        isRecord(l.from) &&
        l.from.id === mechId &&
        isRecord(l.to) &&
        typeof l.to.id === 'string'
    )
    if (!link || !isRecord(link.to)) continue

    const pilotId = link.to.id as string
    const pilot = (await pilotStore.get(pilotId)) as Record<string, unknown> | undefined
    if (!pilot) continue

    const existing = Array.isArray(pilot.partners) ? (pilot.partners as unknown[]) : []
    // Idempotent: v11 may already have minted a partner for this same stat
    // block off the pilot's `equipmentLoadouts`. Re-adding would give the pilot
    // two of a companion they field one of.
    const alreadyPresent = existing.some(
      (p) => isRecord(p) && p.hostRef === mech.chassisRef && p.hostSchema === 'equipment'
    )
    if (!alreadyPresent) {
      await pilotStore.put({
        ...pilot,
        partners: [...existing, partnerFromCompanionMech(mech)],
      })
    }

    // The mech row and every link touching it go, in that order.
    await mechStore.delete(mechId)
    for (const l of allLinks) {
      const touches =
        (isRecord(l.from) && l.from.id === mechId) || (isRecord(l.to) && l.to.id === mechId)
      if (touches && typeof l.id === 'string') await softLinkStore.delete(l.id)
    }
  }

  // ── Part 2 ────────────────────────────────────────────────────────────────
  if (has(STORE_NAMES.crawlers)) {
    const crawlerStore = tx.objectStore(STORE_NAMES.crawlers)
    const gladhand = await crawlerStore.get(GLADHAND_ID)
    if (gladhand) {
      const haven = await crawlerStore.get(HAVEN_ID)
      for (const l of allLinks) {
        if (!isRecord(l.to) || l.to.id !== GLADHAND_ID || typeof l.id !== 'string') continue
        // Repoint to Haven when it exists; drop the dangling link when it does
        // not (the user deleted Haven, so there is nothing to move them to).
        if (haven) {
          await softLinkStore.put({ ...l, to: { ...l.to, id: HAVEN_ID } })
        } else {
          await softLinkStore.delete(l.id)
        }
      }
      await crawlerStore.delete(GLADHAND_ID)
    }
  }
}
