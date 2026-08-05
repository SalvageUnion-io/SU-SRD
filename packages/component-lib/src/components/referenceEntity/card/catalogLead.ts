import type { SURefEntity, SURefObjectContentBlock } from 'salvageunion-reference'
import { extractVisibleActions, resolveGrantedEntities } from 'salvageunion-reference'
import { firstParagraphText } from './firstParagraphText'

/**
 * CATALOG LEAD — the prose a catalog tile falls back to when the entity itself
 * carries no body prose.
 *
 * A catalog tile is artwork + description, and every nested element (granted
 * entities, actions, patterns, roll tables) is suppressed so an index page reads
 * uniformly. For a large family of entities that suppression removes ALL of
 * their substance: a Bio-Maw, a Green Laser Turret, an Adrenal Glands module and
 * a Chimerium Mutant Squad carry no prose of their own — everything they mean
 * lives in the actions they grant. Their tiles rendered as a bare paper strip
 * under the stat band.
 *
 * So the tile borrows an opening line from what it suppressed, in the order the
 * entity's substance actually lives:
 *
 * 1. GRANTS — a grant-equipment ability (Holo Companion) has only a description
 *    and the thing it grants; the granted entity's opening paragraph is what the
 *    ability is *for*.
 * 2. ACTIONS — an entity whose meaning is its actions (every case above) leads
 *    with those actions' opening paragraphs.
 *
 * This borrows, it never invents: an entity with nothing to borrow (Steel Billy
 * Club, a Crawler Tech Level) yields nothing and the caller drops the empty body
 * band rather than rendering a blank strip.
 *
 * ONE paragraph, never more. The tile's body is a DESCRIPTION slot, not a
 * summary of everything the entity was going to show. An Adrenal Glands module
 * grants both Burst and Power; printing both leads concatenates two unlabelled
 * sentences that read as a run-on, because the action names that made them make
 * sense are exactly what catalog mode suppressed. So the tile takes the first
 * and stops — the entity's own page carries the rest.
 *
 * REDUNDANCY GUARD — `exclude` is the text already on the card (the header's
 * flavour hint); a borrowed line identical to it is skipped rather than said
 * twice, and the next candidate is tried in its place.
 */
export function resolveCatalogLeadBlocks(
  entity: SURefEntity,
  exclude?: string
): SURefObjectContentBlock[] {
  const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase()
  const excluded = exclude ? normalize(exclude) : undefined

  const candidates: (string | undefined)[] = [
    ...resolveGrantedEntities(entity).map((granted) =>
      firstParagraphText('content' in granted ? granted.content : undefined)
    ),
    ...(extractVisibleActions(entity) ?? []).map((action) => firstParagraphText(action.content)),
  ]

  const lead = candidates.find((text) => {
    if (!text) return false
    const key = normalize(text)
    return key.length > 0 && key !== excluded
  })
  return lead ? [{ type: 'paragraph', value: lead }] : []
}
