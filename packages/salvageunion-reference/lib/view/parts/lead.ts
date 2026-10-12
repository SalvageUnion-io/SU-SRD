/**
 * An entity's LEAD: its own opening prose as plain text. Ported from
 * component-lib's `compactLead.ts` / `firstParagraphText.ts`.
 */

import { parseContentBlockString } from '../../contentBlockHelpers'
import { isAbility } from '../../entityGuards'
import type {
  SURefMetaEntity,
  SURefObjectContentBlock,
  SURefObjectGuideStep,
} from '../../schemas/index'
import { plainTraitText } from '../../traitText'

/** A content array's first paragraph, as text (references still marked up). */
export function firstParagraphText(
  content: SURefObjectContentBlock[] | undefined
): string | undefined {
  const paragraph = content?.find((block) => block?.type === 'paragraph')
  return paragraph ? parseContentBlockString(paragraph) : undefined
}

/**
 * A guide's first step paragraph — the preamble of a guide (Salvaging, Upgrading
 * your Union Crawler) that keeps every word in `steps`. A data-shape check, as
 * component-lib's `resolveGuideLead`.
 */
function firstStepParagraphText(entity: SURefMetaEntity): string | undefined {
  if (!('steps' in entity) || !Array.isArray(entity.steps)) return undefined
  for (const step of entity.steps as SURefObjectGuideStep[]) {
    const lead = firstParagraphText(step?.content)
    if (lead) return lead
  }
  return undefined
}

/**
 * The lead: an ability's description, else the entity's first paragraph — the
 * lore a chassis, class or denizen opens with — else, for a guide with no
 * preamble of its own, its first step's. Its own prose only: a system whose
 * meaning lives in its actions has none. Plain text, since a clamped line
 * renders no references.
 */
export function entityLead(entity: SURefMetaEntity): string | undefined {
  const description =
    isAbility(entity) && typeof entity.description === 'string' ? entity.description : undefined
  const lead =
    description ||
    firstParagraphText('content' in entity ? entity.content : undefined) ||
    firstStepParagraphText(entity)
  return lead ? plainTraitText(lead) : undefined
}
