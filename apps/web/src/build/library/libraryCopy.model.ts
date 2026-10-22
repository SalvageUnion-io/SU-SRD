/**
 * "Make a copy" from the Homebrew library: the listing, written as a new thing
 * of your own in your Training Bay, through the same stores every other copy
 * goes through (a pattern's page, Shelves). The copy is yours and the listing
 * is untouched; it keeps no link to it (`lib/copyEntity.ts`).
 */

import type { Npc } from 'game-domain/schemas/npc'
import type { LibraryItem } from '../../lib/library/library'
import { npcLibraryCopy } from '../../lib/library/library'
import { patternCopy } from '../../lib/patterns/patterns'
import { useEntityStore } from '../../stores/entityStore'
import { usePatternStore } from '../../stores/patternStore'
import type { CreateInput } from '../../stores/types'

/** Copy a listing to your Training Bay; resolves to the copy's name. */
export async function copyLibraryItem(item: LibraryItem): Promise<string> {
  if (item.kind === 'pattern') {
    const created = await usePatternStore.getState().create(patternCopy(item.pattern))
    return created.name
  }
  return await copyNpc(item.npc)
}

/** Copy a shared NPC to your Training Bay, listed or not; resolves to the copy's name. */
export async function copyNpc(npc: Npc): Promise<string> {
  const created = await useEntityStore
    .getState()
    .create('npc', npcLibraryCopy(npc) as CreateInput<'npc'>)
  return created.name
}
