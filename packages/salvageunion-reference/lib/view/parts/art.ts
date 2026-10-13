/** An entity's ART: its artwork, or none. Nothing stands in for missing art. */

import { getAssetUrl } from '../../assets'
import type { SURefMetaEntity } from '../../schemas/index'
import type { EntityArt } from '../types'

/** The model's art: the image, or no art place at all. */
export function entityArt(entity: SURefMetaEntity): EntityArt {
  const url = getAssetUrl(entity)
  return url ? { kind: 'image', url } : { kind: 'none' }
}
