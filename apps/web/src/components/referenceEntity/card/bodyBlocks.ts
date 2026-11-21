/**
 * What the card's BODY says, before any of it is rendered — pure, split out of
 * `ReferenceEntityCard.tsx`.
 */

import type { RefObjectContentBlock } from 'salvageunion-reference'
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
  grantedText = '',
  entityName = '',
}: {
  /** The entity's own content (or the titanic meta-action's remainder). */
  content: RefObjectContentBlock[] | undefined
  damagedEffect: string | undefined
  isGrantContext: boolean
  /** The folded action's content, when it is the entity's SELF-action. */
  selfActionContent: RefObjectContentBlock[] | undefined
  /** A pattern view or the titanic meta-action shows its body whenever it has one. */
  alwaysShow: boolean
  /** A granting ability collapses its own prose in favour of the granted cards. */
  isGrantingAbility: boolean
  /** The granted cards' prose: a granting ability keeps only what they do not print. */
  grantedText?: string
  /** The entity's name: its words do not count when a paragraph is matched to its self-action's. */
  entityName?: string
}): { bodyBlocks: RefObjectContentBlock[]; showBody: boolean } {
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
  const entityBodyBlocks = withoutDataValues(bodyContent ?? [])
  const selfActionBlocks = selfActionContent ? withoutDataValues(selfActionContent) : []
  const selfActionTexts = selfActionBlocks.map(blockPlainText)
  const dedupedEntityBlocks = selfActionBlocks.length
    ? entityBodyBlocks.filter((b) => {
        const t = blockPlainText(b).trim()
        return t.length === 0 || !repeatsAny(t, selfActionTexts, entityName)
      })
    : entityBodyBlocks
  const allBlocks: RefObjectContentBlock[] = [...dedupedEntityBlocks, ...selfActionBlocks]
  // A granting ability's prose mostly repeats the card it grants; what the
  // granted card does not print (Mecha Packmaster's second companion) stays.
  const grantedKey = proseKey(grantedText, undefined)
  const bodyBlocks =
    isGrantingAbility && !alwaysShow
      ? allBlocks.filter((b) => {
          const key = proseKey(blockPlainText(b), undefined)
          return key.length > 0 && !grantedKey.includes(key)
        })
      : allBlocks
  const showBody = bodyBlocks.length > 0
  return { bodyBlocks, showBody }
}

/** The share of a paragraph's words one other paragraph must hold to be the same rule reworded. */
const REWORDED = 0.8

/** A paragraph's distinct words (`proseKey`'s), less the entity's own name. */
function wordsOf(text: string, entityName: string): Set<string> {
  const name = new Set(proseKey(entityName, undefined).split(' '))
  return new Set(
    proseKey(text, undefined)
      .split(' ')
      .filter((word) => word.length > 0 && !name.has(word))
  )
}

/**
 * Whether a paragraph of the entity repeats one its self-action prints: the
 * action's text holds its opening, or one of the action's paragraphs holds
 * nearly all its words. The book states a rule on the equipment and again on
 * its action in other words ("Choose if your Custom Sniper Rifle is a
 * Ballistic or Energy weapon. It gains…" / "Choose if it is a Ballistic or
 * Energy weapon and it gains…"); the action's is the one printed.
 */
function repeatsAny(text: string, others: readonly string[], entityName: string): boolean {
  if (others.some((other) => other.includes(text.slice(0, 40)))) return true
  const words = [...wordsOf(text, entityName)]
  if (words.length === 0) return false
  return others.some((other) => {
    const theirs = wordsOf(other, entityName)
    return words.filter((word) => theirs.has(word)).length >= words.length * REWORDED
  })
}

/**
 * A body's blocks less its `datavalues`, whose chips the card's band prints. A
 * labelled one keeps its label in its place, so the prose still says what the
 * chips are ("You are able to make the following Meld Tendril Attack:").
 */
function withoutDataValues(blocks: RefObjectContentBlock[]): RefObjectContentBlock[] {
  return blocks.flatMap((b): RefObjectContentBlock[] => {
    if (b?.type !== 'datavalues') return [b]
    return b.label ? [{ type: 'paragraph', value: b.label }] : []
  })
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
 * NO REPEATED PROSE: a nested child hides any paragraph its parent
 * already prints — the Sestra Drone's description, under the Drone Controller
 * ability that says the same thing. `shown` holds the parent's `proseKey`s.
 */
export function hideShownProse(
  blocks: RefObjectContentBlock[],
  shown: readonly string[] | undefined,
  chassisName: string | undefined
): RefObjectContentBlock[] {
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
  isPattern,
  asideLeadRequested,
  hasTrailingSection,
}: {
  showImage: boolean
  isPattern: boolean
  asideLeadRequested: boolean
  /** `afterExtraContent` is present. */
  hasTrailingSection: boolean
}): { asideLead: boolean; flat: boolean } {
  const asideLead = showImage && (isPattern || (asideLeadRequested && hasTrailingSection))
  return { asideLead, flat: showImage && !asideLead }
}
