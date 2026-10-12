/**
 * The card's CHROME rules — how a card is coloured, framed and interacted
 * with, and what its header hint says, as opposed to the content it carries.
 * Split out of `ReferenceEntityCard.tsx` (audit PK-08); every function here is
 * pure. The nodes they feed are `CardTopRail` and the header.
 */

import type { CSSProperties } from 'react'
import type { SURefMetaEntity, SURefObjectContentBlock } from 'salvageunion-reference'
import { headerFill, isAbility, parseContentBlockString } from 'salvageunion-reference'
import type { Foreground } from '../../../design/contrast'
import { cn } from '../../../utils/cn'
import { activateOnKey, FOCUS_RING } from '../../atoms/interaction'
import type { CardExtent, CardSize } from '../../containers/displayMode'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'
import { onTone, textBand } from '../referenceEntityHelpers'
import type { CardOuterProps } from './CardOuter'
import type { DomainTone } from './entityCardTone'
import { firstParagraphText } from './firstParagraphText'

/** The book's pennant: a box with a pointed tail. Hard edges, no tail rounding.
 *  The card's cost pennant and the link preview's (`OgCard`) both cut it. */
export const PENNANT_SHAPE = 'polygon(0 0, 82% 0, 100% 50%, 82% 100%, 0 100%)'

/** What the User-made stamp and pill say when hovered (ruleset §3.9). */
export const USER_MADE_TITLE = 'Made by a player, not from the Workshop Manual'

/** The flat grey header of a damaged/destroyed card: ink half-mixed into paper —
 * the same warm material at distance. */
export const GREY_HEADER = 'color-mix(in srgb, var(--color-ink) 50%, var(--color-paper))'

/**
 * The header's two fills (ruleset §5, board E1): a TONE header for things you
 * HAVE (chassis, systems, gear, denizens), an INK header — the book's ink
 * banner — for things you DO (abilities, actions).
 */
export type HeaderFill = 'tone' | 'ink'

/**
 * Which fill a card's header takes, by data shape. Things you do (abilities,
 * actions) are the ink banner at every extent, the compact card included: the
 * Core tier fill is rust's near twin and reads as a button (ruleset §3.1). An
 * ability's tier rides on its numeral and pennant.
 */
export function resolveHeaderFill(entity: SURefMetaEntity, extent: CardExtent): HeaderFill {
  // The entity model's rule (E12), with the compact card as its Row.
  return headerFill(entity, extent === 'head' ? 'row' : 'card')
}

/** Every colour a card's header takes. The frame, the "//" line and the footer
 * are ink on paper on every card, so they need no colour of their own. */
export type CardColors = {
  /** The foreground for the header band — see `resolveCardColors`. */
  onBand: Foreground
  /** The band's fill as a CSS colour; `undefined` leaves it paper. */
  bandColor: string | undefined
}

/**
 * The header band's colours.
 *
 * - TONE fill: the entity's own tone. ONE tone per entity — a nested child
 *   wears its own, never a blend of its parent's. (The ghosted action tones
 *   are retired: an action is an ink banner, not a faded relative of its host.)
 *   Crawler pink carries neither ink nor paper at 4.5:1, so a crawler header
 *   paints the deeper crawler band and prints paper (ruleset §3.8, `textBand`).
 * - INK fill: `--color-ink`, paper text.
 * - DAMAGED/DESTROYED (write layer): the header goes flat grey, whatever the fill.
 *
 * FOREGROUNDS go by WCAG contrast against the band actually painted
 * (`onTone`): "solid tones read paper" measured 1.79:1 on TL1, 2.41:1 on
 * pilot and 3.03:1 on mech, so the title is ink or paper, whichever passes.
 */
export function resolveCardColors({
  tone,
  isDown,
  fill,
}: {
  tone: DomainTone
  isDown: boolean
  fill: HeaderFill
}): CardColors {
  if (isDown) return { onBand: onTone(GREY_HEADER, 'ink'), bandColor: GREY_HEADER }
  if (fill === 'ink') return { onBand: 'paper', bandColor: 'var(--color-ink)' }
  // A tone that carries neither foreground at 4.5:1 paints its deeper text
  // band instead (ruleset §3.8): crawler pink becomes the crawler band, paper text.
  const band = tone.bgColor ?? tone.bg
  return { onBand: onTone(band, 'paper'), bandColor: textBand(band) }
}

/**
 * The frame's weight. It steps with size and depth (ruleset §4.3, board E2):
 * 3px for the large solo card, 2px one size down, 1.5px for a small card and
 * for the one-line head row a card nests at depth 2.
 */
export function resolveFrameWidth({
  size,
  extent,
  depth,
}: {
  size: CardSize
  extent: CardExtent
  depth: number
}): string {
  if (size === 'small' || (extent === 'head' && depth >= 2)) return 'var(--bw-chrome)'
  return size === 'large' ? 'var(--bw-entity)' : 'var(--bw-entity-compact)'
}

/**
 * WRITE LAYER — whole-card affordances shared by every return of the card. All
 * of these collapse to nothing when their props are absent, so the rendered
 * wrapper is byte-identical to read-only.
 */
export function resolveCardInteraction({
  onCardClick,
  controls,
  cardClickable,
  disabled,
  selectable,
  className,
  selectionRole,
  cardClickLabel,
  selected,
  frameWidth,
  dashed,
}: {
  onCardClick: (() => void) | undefined
  controls: ReferenceEntityControl[] | undefined
  cardClickable: boolean | undefined
  disabled: boolean | undefined
  selectable: boolean | undefined
  className: string | undefined
  selectionRole: 'toggle' | 'radio' | undefined
  cardClickLabel: string | undefined
  selected: boolean | undefined
  /** From `resolveFrameWidth`. */
  frameWidth: string
  /** USER-MADE (ruleset §3.9): a dashed ink frame in place of the solid one. */
  dashed: boolean
}): {
  outer: CardOuterProps
  frameStyle: CSSProperties
} {
  const clickControl = controls?.find((c) => c.cardClick)
  const resolvedCardClick = onCardClick ?? clickControl?.onClick
  // ONE CONTROL: when the click comes from a control the card SHOWS (a folded
  // card's chevron), that control is the keyboard and screen-reader path, and
  // the wrapper is a pointer convenience only — no role, no tab stop, no name.
  // A `role="button"` wrapper around a visible button made two tab stops named
  // the same, nested one interactive inside another, and turned the card's
  // content presentational, so a screen reader could not read its stats.
  const pointerOnly = !onCardClick && !!clickControl && !clickControl.hidden
  const isHoverable = !!resolvedCardClick || !!cardClickable
  // Classes, not a style object: a caller's `className` may override any of
  // these (`.su-ec-outer` in `styles/index.css`).
  const outerClassName = cn(
    'su-ec-outer',
    disabled && 'su-ec-outer--dim',
    selectable === false && 'su-ec-outer--unselectable',
    // Flat chrome (brand refresh P2a): a clickable card says so with the pointer, not by
    // lifting and scaling off the page.
    isHoverable && 'su-ec-outer--clickable',
    resolvedCardClick && !pointerOnly && FOCUS_RING,
    className
  )
  // Base a11y for a clickable card. A selection toggle announces its state:
  // `toggle` → role=button + aria-pressed; `radio` → a `RadioCard`
  // (role=radio + aria-checked, and the arrow keys inside a `RadioCardGroup`).
  // `cardClickLabel` gives the wrapper an accessible name (the entity title)
  // instead of its full text content. Navigation/add cards leave both unset and
  // stay a plain role=button.
  const label = cardClickLabel ? { 'aria-label': cardClickLabel } : {}
  // A DISCLOSURE control on the card's rail (the fold chevron) controls the
  // whole card, so the wrapper takes the id its `aria-controls` names.
  const id = controls?.find((c) => c.ariaExpanded !== undefined)?.ariaControls
  const idAttr = id ? { id } : {}
  const outer: CardOuterProps =
    resolvedCardClick && selectionRole === 'radio'
      ? {
          className: outerClassName,
          interaction: label,
          radio: { selected: !!selected, onSelect: resolvedCardClick },
        }
      : {
          className: outerClassName,
          interaction: !resolvedCardClick
            ? idAttr
            : pointerOnly
              ? { ...idAttr, onClick: resolvedCardClick }
              : {
                  ...idAttr,
                  role: 'button' as const,
                  tabIndex: 0,
                  onClick: resolvedCardClick,
                  onKeyDown: activateOnKey(resolvedCardClick),
                  ...label,
                  ...(selectionRole && selected !== undefined ? { 'aria-pressed': selected } : {}),
                },
        }
  // Selection state — the canonical SELECTION_RING (atoms/interaction.ts), the
  // same 3px ink ring the wizard Sel/PickCard draw. A non-layout-shifting
  // box-shadow that reads as a border, sitting just outside the frame.
  // The frame is INK on every card (the tone lives in the header band alone),
  // and dashed on a user-made one. Longhands, so a caller overriding one side
  // never trips React's shorthand/longhand warning.
  const frame: CSSProperties = {
    borderStyle: dashed ? 'dashed' : 'solid',
    borderColor: 'var(--color-ink)',
    borderTopWidth: frameWidth,
    borderRightWidth: frameWidth,
    borderBottomWidth: frameWidth,
    borderLeftWidth: frameWidth,
  }
  const frameStyle = selected ? { ...frame, boxShadow: '0 0 0 3px var(--color-ink)' } : frame
  return { outer, frameStyle }
}

/**
 * The card's hint text and, for the titanic meta-action, the body it leaves
 * behind.
 *
 * - ABILITY flavor — the short description. An ability is an ink banner now
 *   (tier numeral, title, cost pennant), so the card prints it as the body's
 *   lead rather than on the band.
 * - TITANIC: the intro paragraph becomes the hint; the REMAINING content
 *   blocks (the options list) render in the body.
 * - A pattern LISTING row shows its first paragraph on the header, truncated
 *   to the row's one line.
 */
export function resolveHeaderHint(
  entity: SURefMetaEntity,
  {
    isTitanicMeta,
    patternListingContent,
  }: {
    isTitanicMeta: boolean
    /** A pattern LISTING row's content, else undefined. */
    patternListingContent: SURefObjectContentBlock[] | undefined
  }
): { hintText: string | undefined; titanicBodyContent: SURefObjectContentBlock[] | undefined } {
  const description =
    isAbility(entity) && typeof entity.description === 'string' ? entity.description : undefined
  const titanicContent = isTitanicMeta && 'content' in entity ? entity.content : undefined
  const titanicIntro = titanicContent?.[0]
  const titanicIntroIsParagraph = titanicIntro?.type === 'paragraph'
  const titanicHintText =
    titanicIntro && titanicIntroIsParagraph ? parseContentBlockString(titanicIntro) : undefined
  const titanicBodyContent = titanicContent
    ? titanicIntroIsParagraph
      ? titanicContent.slice(1)
      : titanicContent
    : undefined
  const patternListingHint = firstParagraphText(patternListingContent)
  return {
    hintText: description ?? (titanicHintText || undefined) ?? patternListingHint,
    titanicBodyContent,
  }
}
