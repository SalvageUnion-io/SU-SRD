/**
 * An entity's LEAD: its own opening prose as plain text.
 */

import { extractVisibleActions } from '../../actionResolution'
import { parseContentBlockString } from '../../contentBlockHelpers'
import { isAbility } from '../../entityGuards'
import { resolveGrantedEntities } from '../../helpers'
import type {
  RefEntity,
  RefMetaEntity,
  RefObjectContentBlock,
  RefObjectGuideStep,
} from '../../schemas/index'
import { plainTraitText } from '../../traitText'

/** A content array's first paragraph, as text (references still marked up). */
export function firstParagraphText(
  content: RefObjectContentBlock[] | undefined
): string | undefined {
  const paragraph = content?.find((block) => block?.type === 'paragraph')
  return paragraph ? parseContentBlockString(paragraph) : undefined
}

/**
 * A guide's first step paragraph — the preamble of a guide (Salvaging, Upgrading
 * your Union Crawler) that keeps every word in `steps`. A data-shape check, as
 * the UI library's `resolveGuideLead`.
 */
function firstStepParagraphText(entity: RefMetaEntity): string | undefined {
  if (!('steps' in entity) || !Array.isArray(entity.steps)) return undefined
  for (const step of entity.steps as RefObjectGuideStep[]) {
    const lead = firstParagraphText(step?.content)
    if (lead) return lead
  }
  return undefined
}

/**
 * The first paragraph of what an entity grants, else of its visible actions —
 * where a system, a piece of equipment or a grant ability (Holo Companion)
 * keeps all of its prose. The same order as the UI library's
 * `resolveCatalogLeadBlocks`.
 */
function borrowedParagraphText(entity: RefMetaEntity): string | undefined {
  for (const granted of resolveGrantedEntities(entity as RefEntity)) {
    const lead = firstParagraphText('content' in granted ? granted.content : undefined)
    if (lead) return lead
  }
  for (const action of extractVisibleActions(entity) ?? []) {
    const lead = firstParagraphText(action.content)
    if (lead) return lead
  }
  return undefined
}

/**
 * The lead: an ability's description, else the entity's first paragraph — the
 * lore a chassis, class or denizen opens with — else, for a guide with no
 * preamble of its own, its first step's, else the opening paragraph of what it
 * grants or does (a First Aid Kit's action). Every listing leads with prose
 * when the entity carries any. Plain text, since a clamped line renders no
 * references.
 */
export function entityLead(entity: RefMetaEntity): string | undefined {
  const description =
    isAbility(entity) && typeof entity.description === 'string' ? entity.description : undefined
  const lead =
    description ||
    firstParagraphText('content' in entity ? entity.content : undefined) ||
    firstStepParagraphText(entity) ||
    borrowedParagraphText(entity)
  return lead ? plainTraitText(lead) : undefined
}
