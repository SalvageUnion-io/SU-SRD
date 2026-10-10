/**
 * The card's CHROME rules — how a card is coloured, framed and interacted
 * with, and what its header hint says, as opposed to the content it carries.
 * Split out of `ReferenceEntityCard.tsx` (audit PK-08); every function here is
 * pure. The nodes they feed are `CardTopRail` and the header.
 */

import type { CSSProperties } from 'react'
import type { SURefMetaEntity, SURefObjectContentBlock } from 'salvageunion-reference'
import { isAbility, parseContentBlockString } from 'salvageunion-reference'
import { cn } from '../../../utils/cn'
import { activateOnKey, FOCUS_RING } from '../../chrome/interaction'
import type { CardExtent, CardSize } from '../../shared/displayMode'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'
import type { OnToneText } from '../referenceEntityHelpers'
import { borderColorFromHeaderBg, onToneText } from '../referenceEntityHelpers'
import type { CardOuterProps } from './CardOuter'
import type { DomainTone } from './entityCardTone'
import { firstParagraphText } from './firstParagraphText'

/** What the User-made stamp and pill say when hovered (ruleset §3.9). */
export const USER_MADE_TITLE = 'Made by a player, not from the Workshop Manual'

/** The flat grey header of a damaged/destroyed card: ink half-mixed into paper —
 * the same warm material at distance. */
const GREY_HEADER = 'color-mix(in srgb, var(--color-ink) 50%, var(--color-paper))'

/**
 * The header's two fills (ruleset §5, board E1): a TONE header for things you
 * HAVE (chassis, systems, gear, denizens), an INK header — the book's ink
 * banner — for things you DO (abilities, actions).
 */
export type HeaderFill = 'tone' | 'ink'

/** Every colour a card's header takes. The frame, the "//" line and the footer
 * are ink on paper on every card, so they need no colour of their own. */
export type CardColors = {
  /** The foreground for the header band — see `resolveCardColors`. */
  onBandText: OnToneText
  headerBg: string | undefined
  headerBgColor: string | undefined
}

/**
 * The header band's colours.
 *
 * - TONE fill: the entity's own tone. ONE tone per entity — a nested child
 *   wears its own, never a blend of its parent's. (The ghosted action tones
 *   are retired: an action is an ink banner, not a faded relative of its host.)
 * - INK fill: `--color-ink`, paper text.
 * - DAMAGED/DESTROYED (write layer): the header goes flat grey, whatever the fill.
 *
 * FOREGROUNDS go by WCAG contrast against the band actually painted
 * (`onToneText`): "solid tones read paper" measured 1.79:1 on TL1, 2.41:1 on
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
  if (isDown) {
    return {
      onBandText: onToneText(GREY_HEADER, 'text-ink'),
      headerBg: undefined,
      headerBgColor: GREY_HEADER,
    }
  }
  if (fill === 'ink') {
    return { onBandText: 'text-paper', headerBg: undefined, headerBgColor: 'var(--color-ink)' }
  }
  return {
    onBandText: onToneText(borderColorFromHeaderBg(tone.bg, tone.bgColor), 'text-paper'),
    headerBg: tone.bg,
    headerBgColor: tone.bgColor,
  }
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
  const resolvedCardClick = onCardClick ?? controls?.find((c) => c.cardClick)?.onClick
  const isHoverable = !!resolvedCardClick || !!cardClickable
  const outerClassName = cn(
    'relative flex min-w-0 flex-col overflow-visible',
    disabled && 'opacity-50',
    selectable === false && 'opacity-50 saturate-50',
    // Flat chrome (brand refresh P2a): a clickable card says so with the pointer, not by
    // lifting and scaling off the page.
    isHoverable && 'cursor-pointer',
    resolvedCardClick && FOCUS_RING,
    className
  )
  // Base a11y for a clickable card. A selection toggle announces its state:
  // `toggle` → role=button + aria-pressed; `radio` → a `RadioCard`
  // (role=radio + aria-checked, and the arrow keys inside a `RadioCardGroup`).
  // `cardClickLabel` gives the wrapper an accessible name (the entity title)
  // instead of its full text content. Navigation/add cards leave both unset and
  // stay a plain role=button.
  const label = cardClickLabel ? { 'aria-label': cardClickLabel } : {}
  const outer: CardOuterProps =
    resolvedCardClick && selectionRole === 'radio'
      ? {
          className: outerClassName,
          interaction: label,
          radio: { selected: !!selected, onSelect: resolvedCardClick },
        }
      : {
          className: outerClassName,
          interaction: resolvedCardClick
            ? {
                role: 'button' as const,
                tabIndex: 0,
                onClick: resolvedCardClick,
                onKeyDown: activateOnKey(resolvedCardClick),
                ...label,
                ...(selectionRole && selected !== undefined ? { 'aria-pressed': selected } : {}),
              }
            : {},
        }
  // Selection state — the canonical SELECTION_RING (chrome/interaction.ts), the
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
