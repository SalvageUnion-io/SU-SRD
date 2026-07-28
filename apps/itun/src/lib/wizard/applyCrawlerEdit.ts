/**
 * Crawler edit-save crew/type multi-write — the fragile persistence used by the
 * live sheet's inline type editor (CrawlerTypeEditModal). It is derived from the
 * crawler wizard's original edit branch (CrawlerBuilder.handleSubmit); the
 * wizard now only creates, so this is the single live caller.
 *
 * It writes:
 *   - Per-bay `updateCrawlerBay` calls (structured NPC name/description) so a
 *     bay's live HP / condition survive an edit pass. These target the
 *     `crawlerBays` array and stay separate.
 *   - ONE merged crawler-record update carrying the (optional) `type` field, the
 *     merged `bayChoices` (Keepsake/Motto), and the `typeNpc`. Bundling them in
 *     a single `store.update` keeps a type change atomic-at-record: it can't
 *     half-apply as new-type + stale-NPC if a later write fails.
 *
 * On a type change the orphaned OLD type's bayChoices key is dropped, and the
 * type NPC RESETS to the new type's default (HP from the new type's
 * `npc.hitPoints`, if any) plus any crew edits — never a merge onto the old
 * type's NPC. When the type is unchanged the typeNpc merges so live HP/condition
 * survive. Bays' live state and the `crawlerBays` / `systems` arrays are never
 * touched here — only crew/type-owned fields.
 */

import type { SURefCrawler } from 'salvageunion-reference'

import type { Crawler } from '../schemas/crawler'
import type { EntityState } from '../../stores/entityStore'
import { WIZARD_TXN } from '../../stores/surfaceProvenance'
import {
  crawlerFormCrewToPatches,
  defaultTypeNpcState,
  type CrawlerWizardFormState,
} from './crawlerFormState'

/**
 * Apply the crew/type portion of a crawler edit save.
 *
 * @param storeState  The live EntityState (write surface).
 * @param crawlerId   The crawler being edited.
 * @param form        The edited form. Only `type` and `crew` are read here.
 * @param oldType     The crawler's type BEFORE this save, or null.
 * @param types       The SRD crawler-type catalog (for the type-NPC reset).
 * @param typeField   When provided, the new `type` value is written in the SAME
 *                    record update as bayChoices/typeNpc (atomic type change).
 *                    Omit when the caller has already written `type` itself.
 */
export async function applyCrawlerCrewAndTypeEdit(
  storeState: EntityState,
  crawlerId: string,
  form: CrawlerWizardFormState,
  oldType: string | null,
  types: SURefCrawler[],
  typeField?: string
): Promise<void> {
  const typeChanged = oldType !== form.type

  // Per-bay crew edits (targeted updateCrawlerBay so live HP/condition survive).
  const crewPatches = crawlerFormCrewToPatches(form)
  for (const [bayRef, patch] of Object.entries(crewPatches.bayPatches)) {
    if (Object.keys(patch).length === 0) continue
    await storeState.updateCrawlerBay(crawlerId, bayRef, patch, undefined, WIZARD_TXN)
  }

  // Accumulate every crawler-RECORD field change into ONE atomic update.
  const fresh = storeState.get('crawler', crawlerId)
  const recordPatch: Partial<Crawler> = {}

  if (typeField !== undefined) recordPatch.type = typeField

  // Merge the crew's Keepsake/Motto selections; on a type change drop the
  // orphaned old type's bayChoices key so a stale NPC's selections don't bleed.
  if (typeChanged || Object.keys(crewPatches.bayChoices).length > 0) {
    const nextBayChoices = { ...(fresh?.bayChoices ?? {}) }
    if (typeChanged && oldType !== null) delete nextBayChoices[oldType]
    Object.assign(nextBayChoices, crewPatches.bayChoices)
    recordPatch.bayChoices = nextBayChoices
  }

  // The type NPC: reset to the new type's default on a type change (never a
  // merge onto the old NPC); merge on an unchanged type so live HP survives.
  if (typeChanged) {
    const baseNpc = form.type ? defaultTypeNpcState(types, form.type) : undefined
    const nextTypeNpc = { ...(baseNpc ?? {}), ...(crewPatches.typeNpc ?? {}) }
    recordPatch.typeNpc = Object.keys(nextTypeNpc).length > 0 ? nextTypeNpc : undefined
  } else if (crewPatches.typeNpc) {
    recordPatch.typeNpc = { ...(fresh?.typeNpc ?? {}), ...crewPatches.typeNpc }
  }

  if (Object.keys(recordPatch).length > 0) {
    await storeState.update('crawler', crawlerId, recordPatch, WIZARD_TXN)
  }
}
