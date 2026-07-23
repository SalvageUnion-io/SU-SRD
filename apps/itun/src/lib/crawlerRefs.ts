/**
 * Shared crawler reference-data lookups.
 *
 * The crawler wizard (lib/wizard/crawlerFormState.ts) and the live sheet
 * (components/sheet/CrawlerSheet.tsx) both need to resolve a stored crawler
 * type / bay ref (id OR name) to its SRD entity, and to find an NPC's freeform
 * choice by name (Keepsake / Motto). These helpers are the single source of
 * truth so both surfaces stay in lockstep.
 *
 * All lookups are id-or-name and salvage-tolerant: a missing catalog (e.g.
 * reference data not yet preloaded) resolves to null rather than throwing.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefCrawler, SURefCrawlerBay } from 'salvageunion-reference'

/** A freeform/permanent NPC choice (its id + display name). */
export type ResolvedNpcChoice = { id: string; name: string }

/** The embedded NPC of a crawler type or bay. */
export type ResolvedNpc = {
  position?: string
  hitPoints?: number
  choices?: ReadonlyArray<ResolvedNpcChoice>
}

/**
 * Resolve a stored crawler-type ref (id or name) to its SRD entity — the full
 * reference record, so consumers can hand it straight to entity cards.
 */
export function resolveCrawlerType(ref: string): (SURefCrawler & { schemaName: string }) | null {
  try {
    const all = SalvageUnionReference.Crawlers.all()
    return all.find((c) => c.id === ref || c.name === ref) ?? null
  } catch {
    return null
  }
}

/** Resolve a stored crawler-bay ref (id or name) to its SRD entity. */
export function resolveCrawlerBay(ref: string): (SURefCrawlerBay & { schemaName: string }) | null {
  try {
    const all = SalvageUnionReference.CrawlerBays.all()
    return all.find((b) => b.id === ref || b.name === ref) ?? null
  } catch {
    return null
  }
}

/**
 * Find an NPC's freeform choice by its SRD name (e.g. 'Keepsake', 'Motto').
 * Returns the choice (id + name) or undefined when the NPC has no such choice
 * — Augmented's A.I. NPC, for instance, carries neither Keepsake nor Motto.
 */
export function findNpcChoiceByName(
  npc: ResolvedNpc | undefined,
  name: string
): ResolvedNpcChoice | undefined {
  return npc?.choices?.find((c) => c.name === name)
}
