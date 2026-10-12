/**
 * The art a player-built entity shows when it has no photo of its own — what
 * an uploaded photo replaces (`EntityPhoto`). Each is the reference entity the
 * build came from: a mech's (or pattern's) chassis, a crawler's type, a built
 * NPC's book template. Where that entity has no artwork there is no default,
 * and the sheet makes room for a photo only while it is being edited.
 */

import type { NpcTemplateRef } from 'itun-domain/schemas/npc'
import type { SURefMetaEntity } from 'salvageunion-reference'
import { findEntityBySlug, getAssetUrl } from 'salvageunion-reference'
import { resolveChassisRef, resolveCrawlerRef } from 'salvageunion-reference/rules'
import type { DefaultArt } from '../../components/shared/EntityPhoto'
import { readReference } from '../readReference'

function artOf(entity: SURefMetaEntity | null | undefined): DefaultArt | undefined {
  if (!entity) return undefined
  const url = getAssetUrl(entity)
  if (url === undefined) return undefined
  return { url, alt: `${'name' in entity ? entity.name : 'Reference'} artwork` }
}

/** A mech's or pattern's chassis art. */
export function chassisArt(chassisRef: string): DefaultArt | undefined {
  return readReference('photo:chassis', () => artOf(resolveChassisRef(chassisRef)), undefined)
}

/** A crawler type's art, where the crawler has a type. */
export function crawlerTypeArt(type: string | undefined): DefaultArt | undefined {
  if (type === undefined) return undefined
  return readReference('photo:crawler', () => artOf(resolveCrawlerRef(type)), undefined)
}

/** A built NPC's book template's art, where it started from a standalone NPC. */
export function npcTemplateArt(templateRef: NpcTemplateRef | undefined): DefaultArt | undefined {
  if (templateRef?.schema !== 'npcs') return undefined
  return readReference(
    'photo:npc',
    () => artOf(findEntityBySlug('npcs', templateRef.slug) as SURefMetaEntity | null),
    undefined
  )
}
