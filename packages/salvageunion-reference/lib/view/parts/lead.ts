/**
 * An entity's LEAD: its own opening prose as plain text. Ported from
 * component-lib's `compactLead.ts` / `firstParagraphText.ts`.
 */

import { parseContentBlockString } from '../../contentBlockHelpers'
import { isAbility } from '../../entityGuards'
import type { SURefMetaEntity, SURefObjectContentBlock } from '../../schemas/index'
import { plainTraitText } from '../../traitText'

/** A content array's first paragraph, as text (references still marked up). */
export function firstParagraphText(
  content: SURefObjectContentBlock[] | undefined
): string | undefined {
  const paragraph = content?.find((block) => block?.type === 'paragraph')
  return paragraph ? parseContentBlockString(paragraph) : undefined
}

/**
 * The lead: an ability's description, else the entity's first paragraph — the
 * lore a chassis, class or denizen opens with. Its own prose only: a system
 * whose meaning lives in its actions has none. Plain text, since a clamped
 * line renders no references.
 */
export function entityLead(entity: SURefMetaEntity): string | undefined {
  const description =
    isAbility(entity) && typeof entity.description === 'string' ? entity.description : undefined
  const lead = description || firstParagraphText('content' in entity ? entity.content : undefined)
  return lead ? plainTraitText(lead) : undefined
}
