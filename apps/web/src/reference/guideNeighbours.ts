/**
 * A guide's neighbours in the book's order (r5 E6): the guide before it and
 * the one after, as the Page's foot draws an ability's in its tree
 * (`NeighbourRow`). The guides' dataset runs in the book's order, as their
 * listing does, so reading them start to finish is one press a chapter.
 */

import type { RefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { Neighbour } from '../components/index'
import { pagesCopy } from '../messages/reference-pages'

export function guideNeighbours(schemaId: string, item: { id: string }): Neighbour[] {
  if (schemaId !== 'guides') return []
  const guides = SalvageUnionReference.findAllIn('guides', () => true) as RefMetaEntity[]
  const at = guides.findIndex((guide) => guide.id === item.id)
  if (at < 0) return []
  const before = guides[at - 1]
  const after = guides[at + 1]
  return [
    { label: pagesCopy('previousGuide'), entities: before ? [before] : [] },
    { label: pagesCopy('nextGuide'), entities: after ? [after] : [], end: true },
  ]
}
