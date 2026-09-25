/**
 * Pure helpers shared by `ReferenceEntityCard` and its section components.
 *
 * Each depends only on its arguments. They were lifted out of the card's body
 * — first to module scope, then (audit PK-08) into this module — because the
 * card's section components need them too, and a helper the sections import
 * from the card would make every section a circular dependency.
 */

import type { ReactNode } from 'react'
import type { SURefObjectChoice, SURefObjectContentBlock } from 'salvageunion-reference'
import { getChoiceSourceKind } from '../choiceCard/choiceSelectionHelpers'
import type { ReferenceCardEntity } from './referenceEntityCardTypes'

/** Beyond this nesting depth a card renders header-only (no body expansion) —
 * bounds runaway recursion (deep chassis → systems → actions, or grant cycles). */
export const MAX_DEPTH = 3

/**
 * Does this record carry structured data for the mechanical change its text
 * states (ADR-029)?
 *
 * Drives the rules-bearing mark on the granting prose, so a reader can see which
 * clause the app actually applies — and so prose that claims a change with NO
 * data stays visibly unmarked, making a coverage gap legible in the product
 * rather than only in CI.
 */
export function isRulesBearing(data: unknown): boolean {
  const record = (data ?? {}) as {
    contributions?: unknown
    statBonus?: unknown
    mutations?: unknown
  }
  return (
    Array.isArray(record.contributions) ||
    record.statBonus != null ||
    Array.isArray(record.mutations)
  )
}

/** A titanic action (bio-titan "Titanic Actions") — gets its own full-width row. */
export function isTitanicAction(action: { name?: string }): boolean {
  return /titanic action/i.test(action.name ?? '')
}

/** FLAT-mode wrapper: when the body has a left ANCHOR (image / floated NPC),
 * each nested card wraps in a `flow-root` block so it flows beside the float,
 * then full width once past it; non-flat renders the card bare (its own key on
 * the card). ONE helper so the five flat/non-flat call sites can't drift. */
export function wrapFlat(flat: boolean, key: string | undefined, card: ReactNode): ReactNode {
  if (!flat) return card
  return (
    <div key={key} className="mb-1.5 flow-root">
      {card}
    </div>
  )
}

/**
 * The element a card's section bands should render as.
 *
 * `titleAs === 'h1'` is already how an item page says "this card IS the
 * document" — `EntityView` / `EntityCardStatic` set it for the entity the URL
 * names, and nothing else does. So the same signal answers the question the
 * section bands need: a `Slab` inside a listing card is a visual separator and
 * must stay a `span`, but a `Slab` inside the card that is the page is that
 * page's section heading and has to be a real one.
 *
 * Before this, an entity page had exactly ONE heading — its `h1` — and every
 * section under it ("Patterns", a guide's numbered steps) was a styled `span`.
 * A screen-reader user got one heading and then an undifferentiated wall, with
 * no way to jump between sections, on the pages whose entire purpose is being
 * jumped around in. Guides were the worst case: `llms.txt` points machine
 * readers at them as the primary source of rules procedures, and their steps
 * are *explicitly numbered* in the visible text — already a document outline in
 * everything but markup.
 *
 * Two things deliberately stay spans:
 *
 * - **Bands inside NESTED cards.** They are separators within a component, not
 *   divisions of the document. A nested card is a separate
 *   `ReferenceEntityCardInner` with no `titleAs`, so this returns `undefined`
 *   for it without any depth check — the level follows the CONTENT, not the
 *   render tree.
 * - **The `parentSeal` stamp** (e.g. "Chassis Ability"). It reads like a
 *   section title but is passed INTO each nested card as its own badge, so
 *   promoting it would emit one `h2` per ability rather than one per section.
 *
 * Returning `undefined` rather than `'span'` keeps `Slab`'s own default as the
 * single source of what a non-heading band is.
 */
export function sectionHeadingLevel(titleAs: 'span' | 'h1' | undefined): 'h2' | undefined {
  return titleAs === 'h1' ? 'h2' : undefined
}

/** React key for a nested card. */
export function cardKey(nested: ReferenceCardEntity, index: number): string {
  return `${'id' in nested && typeof nested.id === 'string' ? nested.id : 'nested'}-${index}`
}

/**
 * Whether a choice would render an empty region.
 *
 * Takes its two dependencies as arguments rather than closing over them, so it
 * sits at module scope with the other pure helpers instead of being rebuilt per
 * render. Same behaviour, no captured state.
 */
export function choiceRendersNothing(
  choice: SURefObjectChoice,
  editableChoices: boolean | undefined,
  selections: Record<string, string[] | undefined> | undefined
): boolean {
  if (editableChoices) return false
  return getChoiceSourceKind(choice) === 'text' && !selections?.[choice.id]?.[0]
}

/** A content block's plain text, or '' for anything that is not plain prose. */
export function blockPlainText(b: SURefObjectContentBlock): string {
  return b && b.type !== 'choice' && typeof b.value === 'string' ? b.value : ''
}
