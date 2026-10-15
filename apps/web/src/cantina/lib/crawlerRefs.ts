/**
 * Shared crawler reference-data lookups.
 *
 * The crawler wizard (lib/wizard/crawlerFormState.ts) and the live sheet
 * (components/sheet/CrawlerSheet.tsx) both need to resolve a stored crawler
 * type / bay slug to its SRD entity, and to find an NPC's freeform choice by
 * name (Keepsake / Motto). These helpers are the single source of truth so
 * both surfaces stay in lockstep.
 *
 * A missing catalog (e.g. reference data not yet preloaded) resolves to null
 * rather than throwing.
 */

import type { RefCrawler, RefCrawlerBay, RefMetaAction } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { resolveCrawlerBayRef, resolveCrawlerRef } from 'salvageunion-reference/rules'
import { readReference } from './readReference'

/** A freeform/permanent NPC choice (its id + display name). */
export type ResolvedNpcChoice = { id: string; name: string }

/** The embedded NPC of a crawler type or bay. */
export type ResolvedNpc = {
  position?: string
  hitPoints?: number
  choices?: ReadonlyArray<ResolvedNpcChoice>
}

/**
 * Resolve a stored crawler-type slug to its SRD entity — the full
 * reference record, so consumers can hand it straight to entity cards.
 */
export function resolveCrawlerType(ref: string): (RefCrawler & { schemaName: string }) | null {
  return readReference('resolveCrawlerType', () => resolveCrawlerRef(ref), null)
}

/**
 * Resolve the crawler type's special-ability action refs (names) to their SRD
 * action entities. Like the other crawler ref lookups, a missing catalog
 * resolves to an empty list rather than throwing.
 */
export function resolveCrawlerTypeAbilities(typeRef: string | undefined): RefMetaAction[] {
  if (!typeRef) return []
  return readReference('resolveCrawlerTypeAbilities', () => {
    const refs = resolveCrawlerType(typeRef)?.actions ?? []
    if (refs.length === 0) return []
    const actions = SalvageUnionReference.Actions.all()
    return refs
      .map((ref) => actions.find((a) => a.id === ref || a.name === ref))
      .filter((a) => a !== undefined)
  }, [])
}

/** Resolve a stored crawler-bay slug to its SRD entity. */
export function resolveCrawlerBay(ref: string): (RefCrawlerBay & { schemaName: string }) | null {
  return readReference('resolveCrawlerBay', () => resolveCrawlerBayRef(ref), null)
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
