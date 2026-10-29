/**
 * Pure helpers shared by `ReferenceEntityCard` and its section components.
 *
 * Each depends only on its arguments. They were lifted out of the card's body
 * — first to module scope, then into this module — because the
 * card's section components need them too, and a helper the sections import
 * from the card would make every section a circular dependency.
 */

import type {
  RefEnumSchemaName,
  RefMetaEntity,
  RefObjectChoice,
  RefObjectContentBlock,
} from 'salvageunion-reference'
import { isChassis, isVehicle } from 'salvageunion-reference'
import { getChoiceSourceKind } from '../choiceCard/choiceSelectionHelpers'
import type {
  CardTitleTag,
  ReferenceCardEntity,
  ReferenceEntityCardHideConfig,
} from './referenceEntityCardTypes'

/** Beyond this nesting depth a card renders header-only (no body expansion) —
 * bounds runaway recursion (deep chassis → systems → actions, or grant cycles). */
export const MAX_DEPTH = 3

/** The schema an entity names at runtime (the static union omits it), typed so a misspelt one fails typecheck. */
export function schemaOf(entity: RefMetaEntity): RefEnumSchemaName | 'actions' | undefined {
  return 'schemaName' in entity && typeof entity.schemaName === 'string'
    ? (entity.schemaName as RefEnumSchemaName | 'actions')
    : undefined
}

/**
 * What a card's own `[(CHASSIS)]` tokens read: a chassis's name, or a vehicle's
 * (the E-Boat's item reuses the Kraken's chassis text); nothing otherwise.
 */
export function chassisMiniName(entity: RefMetaEntity, name: string): string | undefined {
  return isChassis(entity) || isVehicle(entity) ? name : undefined
}

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
  const record = (data ?? {}) as { contributions?: unknown; mutations?: unknown }
  return Array.isArray(record.contributions) || Array.isArray(record.mutations)
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
 * The cards nested in those sections are part of the outline too: on a page
 * each nested card's TITLE is an `h3` under its section's `h2`
 * (`nestedTitleLevel`). An entity page lists what the entity carries — a
 * chassis's systems, a page's actions — and a screen-reader user has to be able
 * to jump between them, not only between the sections that hold them (WCAG
 * 1.3.1, 2.4.6). A card a band's `h2` holds gets the `h3`; a nested entity
 * stacked with no band above it (a System, an NPC, a Drone — its own stamp
 * names it) is a section itself, an `h2` (`stackedTitleLevel`). The chassis
 * ability, beneath the stats under the page's `h1`, keeps a span.
 *
 * Two things still stay spans:
 *
 * - **Bands inside NESTED cards.** They are separators within a component, not
 *   divisions of the document. A nested card is a separate
 *   `ReferenceEntityCardInner` whose `titleAs` is at most `h3`, so this returns
 *   `undefined` for it without any depth check — the level follows the
 *   CONTENT, not the render tree.
 * - **The `parentSeal` stamp** (e.g. "Grants"). It reads like a
 *   section title but is passed INTO each nested card as its own badge, so
 *   promoting it would emit one heading per card on top of the card's title.
 *
 * Returning `undefined` rather than `'span'` keeps `Slab`'s own default as the
 * single source of what a non-heading band is.
 */
export function sectionHeadingLevel(titleAs: CardTitleTag | undefined): 'h2' | undefined {
  return titleAs === 'h1' ? 'h2' : undefined
}

/**
 * The element a NESTED card's title renders as: an `h3` when its host IS the
 * page, under the section band's `h2` (see `sectionHeadingLevel`); otherwise
 * the header's default `span` — inside a listing card a nested card is part of
 * a component, not a division of the document.
 */
export function nestedTitleLevel(hostOnPage: boolean | undefined): 'h3' | undefined {
  return hostOnPage ? 'h3' : undefined
}

/**
 * The element a STACKED nested card's title renders as — one no band holds
 * (`CardStack`): an `h2` when its host IS the page, a section of its own under
 * the page's `h1`; otherwise the header's default `span`.
 */
export function stackedTitleLevel(hostOnPage: boolean | undefined): 'h2' | undefined {
  return hostOnPage ? 'h2' : undefined
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
  choice: RefObjectChoice,
  editableChoices: boolean | undefined,
  selections: Record<string, string[] | undefined> | undefined
): boolean {
  if (editableChoices) return false
  return getChoiceSourceKind(choice) === 'text' && !selections?.[choice.id]?.[0]
}

/** A content block's plain text, or '' for anything that is not plain prose. */
export function blockPlainText(b: RefObjectContentBlock): string {
  return b && b.type !== 'choice' && typeof b.value === 'string' ? b.value : ''
}

/**
 * What a card hides. TERMINAL (ruleset §1, R33): inside a tooltip popup
 * nothing acts, so the roll-table controls go too (the link and the nested
 * Minis are handled where they render).
 */
export function resolveHide(
  hideProp: ReferenceEntityCardHideConfig | undefined,
  insidePeek: boolean
): ReferenceEntityCardHideConfig | undefined {
  return insidePeek ? { ...hideProp, rollTable: true } : hideProp
}

/** Where a card stands, for whether its name links (`namesOwnPage`). */
type CardPlace = {
  onPage: boolean
  depth: number
  insidePeek: boolean
  /** The card is itself a control (a click, a select, a pick's role). */
  interactive: boolean
}

/**
 * Whether a card names its own Page (`CardTitleLink`): one met inside another,
 * nested (depth > 0) or the Peek's own card, and not itself a control.
 */
export function namesOwnPage({ onPage, depth, insidePeek, interactive }: CardPlace) {
  if (onPage || interactive) return false
  return insidePeek ? depth === 0 : depth > 0
}
