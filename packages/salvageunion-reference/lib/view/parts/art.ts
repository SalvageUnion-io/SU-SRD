/**
 * An entity's ART: its artwork, or the censor mark that stands in for it.
 * The mark is chosen from the dataset alone, so it moved here from
 * component-lib's `missingArtMark.ts`; drawing it (the torn edge) stays there.
 */

import { getAssetUrl } from '../../assets'
import { getPageReference, getTechLevel } from '../../entityFields'
import { getModel } from '../../helpers'
import { SalvageUnionReference } from '../../index'
import type { SURefMetaEntity } from '../../schemas/index'
import type { EntityArt, MissingArtVariant } from '../types'

const VARIANTS: readonly MissingArtVariant[] = ['file', 'row', 'removed']

/** A string's FNV-1a hash: the seed for everything derived per entity. */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** The entity's stable seed, from its schema and id. */
function entitySeed(entity: SURefMetaEntity): number {
  const schema = 'schemaName' in entity ? String(entity.schemaName) : ''
  return hash(`${schema}/${entity.id}`)
}

/** A tech level to sort by; a lettered one (B, N) or none sorts first. */
function tier(entity: SURefMetaEntity): number {
  const level = getTechLevel(entity)
  return typeof level === 'number' ? level : 0
}

const ordinals = new WeakMap<readonly SURefMetaEntity[], Map<string, number>>()

/** Each art-less entity's place in its schema's art-less run (tech level, then
 * book order), cached per loaded dataset array. */
function artlessOrdinal(entity: SURefMetaEntity): number | undefined {
  const schema = 'schemaName' in entity ? entity.schemaName : undefined
  if (typeof schema !== 'string' || !SalvageUnionReference.isLoaded(schema)) return undefined
  const all = getModel(schema)?.all()
  if (!all) return undefined
  let order = ordinals.get(all)
  if (!order) {
    order = new Map()
    const run = all.filter((item) => !getAssetUrl(item))
    run.sort((a, b) => tier(a) - tier(b))
    for (const item of run) order.set(item.id, order.size)
    ordinals.set(all, order)
  }
  return order.get(entity.id)
}

/**
 * The censor mark an entity wears: the schema's art-less entities take the
 * three in turn, in listing order, so neighbours differ and a listing and a
 * page always agree. Outside a loaded schema it falls back to the hash.
 */
export function missingArt(entity: SURefMetaEntity): Extract<EntityArt, { kind: 'missing' }> {
  const seed = entitySeed(entity)
  const index = artlessOrdinal(entity) ?? seed
  // The patch's code line, after the manual's `UNION_REG._398.73`.
  const page = getPageReference(entity)
  const padded = page === undefined ? '000' : String(page).padStart(3, '0')
  return {
    kind: 'missing',
    variant: VARIANTS[index % VARIANTS.length] ?? 'file',
    code: `UNION_ARCHIVE._${padded}`,
    short: `P.${padded}`,
    seed,
  }
}

const schemaArt = new WeakMap<readonly SURefMetaEntity[], boolean>()

/** Whether any entity in a loaded schema has artwork: then every one keeps an
 * art place, and one with none wears its censor mark there. */
export function schemaHasArt(schemaName: string): boolean {
  if (!SalvageUnionReference.isLoaded(schemaName)) return false
  const all = getModel(schemaName)?.all()
  if (!all) return false
  let has = schemaArt.get(all)
  if (has === undefined) {
    has = all.some((item) => !!getAssetUrl(item))
    schemaArt.set(all, has)
  }
  return has
}

/** The model's art: the image, else the censor mark where the schema has art. */
export function entityArt(entity: SURefMetaEntity): EntityArt {
  const url = getAssetUrl(entity)
  if (url) return { kind: 'image', url }
  const schema = 'schemaName' in entity ? String(entity.schemaName) : ''
  return schemaHasArt(schema) ? missingArt(entity) : { kind: 'none' }
}
