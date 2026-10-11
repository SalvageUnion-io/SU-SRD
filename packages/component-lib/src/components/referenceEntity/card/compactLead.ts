import type { SURefMetaEntity } from 'salvageunion-reference'
import { firstParagraphText } from './firstParagraphText'

/**
 * The compact card's LEAD (`leadProse`): the entity's own opening prose — an
 * ability's description (`hint`, from `resolveHeaderHint`), else its first
 * paragraph, the lore a chassis, class or denizen opens with. Its own prose
 * only: a system whose meaning lives in its actions has none, and its card
 * stays compact rather than borrowing rules text.
 */
export function compactLead(entity: SURefMetaEntity, hint: string | undefined): string | undefined {
  if (hint) return hint
  return firstParagraphText('content' in entity ? entity.content : undefined)
}

/** Whether the compact card has a body: value cells, a "//" line or a lead. */
export function hasCompactBody(statCount: number, hasSubLine: boolean, lead: string | undefined) {
  return statCount > 0 || hasSubLine || !!lead
}
