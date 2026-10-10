/**
 * What the card's BODY says, before any of it is rendered — pure, split out of
 * `ReferenceEntityCard.tsx` (audit PK-08).
 */

import type { SURefObjectContentBlock } from 'salvageunion-reference'
import { blockPlainText } from './cardHelpers'

/**
 * The body's content blocks, and whether it shows any.
 *
 * Body prose is the entity's own, with duplicated blocks filtered out: the
 * crawler-bay damaged-effect paragraph (it renders in the "WHEN DAMAGED"
 * callout) and, in a grant context, the `lead` block (the containing ability
 * already shows it).
 *
 * A PATTERN VIEW leads with its CHASSIS's prose (on a pattern card the entity IS
 * the chassis), NOT the pattern's: a pattern is a loadout OF a chassis, so the
 * chassis identity reads first and the pattern's own flavour follows the chassis
 * ability, just above its loadout.
 *
 * A SELF-action (a single folded action named like the entity — e.g. Custom
 * Sniper Rifle's own action) carries the entity's real prose AND its choice
 * markers interwoven, so ITS content renders as the body and the choices
 * interleave there; the action is NOT rendered a second time.
 *
 * CONCATENATE, don't replace: the fold merges the entity's own prose with the
 * self-action's prose (identity, then behaviour). Blocks whose text the
 * self-action already contains are dropped so the ~13 equipment whose entity
 * content duplicates the action's don't double-render, while complementary
 * content (unique identity prose, e.g. Water Purification / Hydraulic Shunter)
 * and a self-action-only description (e.g. Grappling Harpoon, whose entity
 * content is empty) are both preserved.
 */
export function resolveBodyBlocks({
  content,
  damagedEffect,
  isGrantContext,
  selfActionContent,
  alwaysShow,
  isGrantingAbility,
}: {
  /** The entity's own content (or the titanic meta-action's remainder). */
  content: SURefObjectContentBlock[] | undefined
  damagedEffect: string | undefined
  isGrantContext: boolean
  /** The folded action's content, when it is the entity's SELF-action. */
  selfActionContent: SURefObjectContentBlock[] | undefined
  /** A pattern view or the titanic meta-action shows its body whenever it has one. */
  alwaysShow: boolean
  /** A granting ability collapses its own prose in favour of the granted cards. */
  isGrantingAbility: boolean
}): { bodyBlocks: SURefObjectContentBlock[]; showBody: boolean } {
  const bodyContent = content?.filter((block) => {
    if (
      damagedEffect &&
      block?.type === 'paragraph' &&
      typeof block.value === 'string' &&
      block.value === damagedEffect
    )
      return false
    if (isGrantContext && block.lead === true) return false
    return true
  })
  const entityBodyBlocks = (bodyContent ?? []).filter((b) => b?.type !== 'datavalues')
  const selfActionBlocks = selfActionContent
    ? selfActionContent.filter((b) => b?.type !== 'datavalues')
    : []
  const selfActionText = selfActionBlocks.map(blockPlainText).join('\n')
  const dedupedEntityBlocks = selfActionBlocks.length
    ? entityBodyBlocks.filter((b) => {
        const t = blockPlainText(b).trim()
        return t.length === 0 || !selfActionText.includes(t.slice(0, 40))
      })
    : entityBodyBlocks
  const bodyBlocks: SURefObjectContentBlock[] = [...dedupedEntityBlocks, ...selfActionBlocks]
  const showBody = alwaysShow ? bodyBlocks.length > 0 : !isGrantingAbility && bodyBlocks.length > 0
  return { bodyBlocks, showBody }
}

/** Below this length a paragraph is too short to call a repeat of anything. */
const MIN_REPEAT_KEY = 24

/**
 * A paragraph's comparison key for "no repeated prose": lower-case words only,
 * `[(CHASSIS)]` resolved to the chassis name, and the article "the" dropped —
 * the book phrases the same sentence "[(CHASSIS)] comes with…" on a chassis
 * ability and "The Little Sestra comes with…" on the drone it names.
 */
export function proseKey(text: string, chassisName: string | undefined): string {
  return text
    .replaceAll('[(CHASSIS)]', chassisName ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word.length > 0 && word !== 'the')
    .join(' ')
}

/** A choice's key in the same "already printed" list (`choice` + its name). */
export function choiceKey(name: string, chassisName: string | undefined): string {
  return `choice ${proseKey(name, chassisName)}`
}

/**
 * NO REPEATED PROSE (board E2): a nested child hides any paragraph its parent
 * already prints — the Sestra Drone's description, under the Drone Controller
 * ability that says the same thing. `shown` holds the parent's `proseKey`s.
 */
export function hideShownProse(
  blocks: SURefObjectContentBlock[],
  shown: readonly string[] | undefined,
  chassisName: string | undefined
): SURefObjectContentBlock[] {
  if (!shown || shown.length === 0) return blocks
  return blocks.filter((block) => {
    if (block?.type !== 'paragraph') return true
    const key = proseKey(blockPlainText(block), chassisName)
    return key.length < MIN_REPEAT_KEY || !shown.some((parent) => parent.includes(key))
  })
}

/**
 * How the body lays out around its left ANCHOR (the artwork, else a nested
 * NPC).
 *
 * ASIDE LEAD — an artwork card whose trailing section is a SECTION of its own
 * (the class pages' ability trees). Those trees are their own grid of cards;
 * letting them flow around the illustration reads as wrapped text, not as a
 * section. So the artwork and the flavour prose become a centred two-column
 * LEAD, and everything after it — the trailing section included — spans the
 * full width beneath both. No float, so nothing wraps.
 *
 * A consumer OPTS IN via `asideLead`; it is still never inferred merely from
 * `afterExtraContent` being present. That slot is generic, so an inferred gate
 * would sweep in any card that happened to fill it, for no reason connected to
 * what the card IS.
 *
 * A PATTERN takes the lead layout on its own identity, which is a different
 * claim: a pattern view is chassis artwork + chassis prose, and then the
 * pattern proper — its own flavour and the Systems/Modules it installs. That
 * second half is a SECTION, exactly like a class page's ability trees, so it
 * belongs below the fold at full width rather than wrapped into the column left
 * over beside the illustration. (This deliberately reverses the earlier ruling
 * that patterns stay out of this layout. That ruling was about not being
 * dragged in ACCIDENTALLY by the generic-slot gate; the loadout now renders
 * inline rather than through `afterExtraContent`, and reads as a section rather
 * than as prose, so the layout is chosen, not inherited.)
 *
 * Artwork is still required either way: with none there is no lead row to
 * build, and a pattern with no chassis art keeps the ordinary flow.
 *
 * FLAT — everything else with an anchor floats it and flows the body (nested
 * cards included) beside and then beneath it.
 */
export function resolveBodyLayout({
  showImage,
  hasNpcAnchor,
  isPattern,
  asideLeadRequested,
  hasTrailingSection,
}: {
  showImage: boolean
  hasNpcAnchor: boolean
  isPattern: boolean
  asideLeadRequested: boolean
  /** `afterExtraContent` is present. */
  hasTrailingSection: boolean
}): { asideLead: boolean; flat: boolean } {
  const hasAnchor = showImage || hasNpcAnchor
  const asideLead = showImage && (isPattern || (asideLeadRequested && hasTrailingSection))
  return { asideLead, flat: hasAnchor && !asideLead }
}
