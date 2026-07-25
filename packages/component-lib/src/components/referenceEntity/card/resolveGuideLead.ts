import type { SURefMetaEntity, SURefObjectGuideStep } from 'salvageunion-reference'
import { firstParagraphText } from './firstParagraphText'

/**
 * A guide's INTRODUCTORY paragraph — the one thing its catalog tile should say.
 *
 * A catalog tile renders an entity's whole `content[]` untruncated, which for
 * guides produced both failure modes at once. Measured on the built
 * `/schema/guides/` listing: **Safety Protocols** rendered 1,236 characters into
 * a tile, while **Salvaging**, **Upgrading your Union Crawler** and **Activating
 * and Shutting Down a Mech** rendered none at all — those three keep every word
 * in `steps` and carry no top-level `content`, so their tiles showed a title and
 * a source line and nothing else.
 *
 * This SELECTS, it never authors. The returned string is a paragraph that
 * already exists in the data, verbatim — there is no summarising, no stitching
 * of several blocks, and deliberately no character truncation (an ellipsis mid-
 * sentence is a worse tile than a slightly long one, and picking a cut-off would
 * be a judgement the data does not make). The unit of "introduction" is the
 * author's own first paragraph.
 *
 * Fallback order, and why it is only two rungs:
 *
 * 1. the guide's own first top-level paragraph — its actual preamble (12 of the
 *    15 shipped guides);
 * 2. failing that, the first paragraph of its first step that has one — for the
 *    three guides whose preamble simply *is* their opening step.
 *
 * Returns `undefined` for a non-guide, and for a guide with no prose anywhere;
 * the caller then falls back to the ordinary body, so this can only ever add
 * text to a tile that had none or narrow one that had too much.
 *
 * A DATA-SHAPE check (`steps`), matching `resolveGuideSteps` — the card layer
 * does not branch on schema names.
 */
export function resolveGuideLead(entity: SURefMetaEntity): string | undefined {
  if (entity == null || typeof entity !== 'object') return undefined
  if (!('steps' in entity) || !Array.isArray(entity.steps)) return undefined

  const own = firstParagraphText('content' in entity ? entity.content : undefined)
  if (own) return own

  for (const step of entity.steps as SURefObjectGuideStep[]) {
    const lead = firstParagraphText(step?.content)
    if (lead) return lead
  }
  return undefined
}
