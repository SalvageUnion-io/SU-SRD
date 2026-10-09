/**
 * The card's CHROME rules — how a card is coloured, framed and interacted
 * with, and what its header hint says, as opposed to the content it carries.
 * Split out of `ReferenceEntityCard.tsx` (audit PK-08); every function here is
 * pure. The nodes they feed are `CardTopRail` and `HeaderHint`.
 */

import type { CSSProperties } from 'react'
import type { SURefMetaEntity, SURefObjectContentBlock } from 'salvageunion-reference'
import { isAbility, parseContentBlockString } from 'salvageunion-reference'
import { cn } from '../../../utils/cn'
import { activateOnKey, FOCUS_RING } from '../../chrome/interaction'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'
import type { OnToneText } from '../referenceEntityHelpers'
import { accentDeepColor, borderColorFromHeaderBg, onToneText } from '../referenceEntityHelpers'
import type { CardOuterProps } from './CardOuter'
import type { DomainTone } from './entityCardTone'
import { ghostActionTone } from './entityCardTone'
import { firstParagraphText } from './firstParagraphText'

/** The flat grey header of a damaged/destroyed card: ink half-mixed into paper —
 * the same warm material at distance. */
const GREY_HEADER = 'color-mix(in srgb, var(--color-ink) 50%, var(--color-paper))'

/** Every colour a card's bands and frame take. */
export type CardColors = {
  /** The foreground for the header band — see `resolveCardColors`. */
  onBandText: OnToneText
  headerBg: string | undefined
  headerBgColor: string | undefined
  /** Sub-header + footer band. */
  darkTone: string
  /** The foreground for `darkTone` — its own decision, not the header's: a
   * light tone's header reads ink while its deep shade still reads paper. */
  onDarkText: OnToneText
  frameColor: string
  /** This entity's own tone base — threaded to its nested action cards as their host. */
  ownToneBase: string
}

/**
 * ACTIONS and NESTED NPCs inherit the summoning (parent) entity's tone,
 * GHOSTED: the header + sub-header bands + 3px frame use the ghosted host
 * tone; the body stays paper/ink. A standalone action (no host) falls back to a
 * neutral base.
 *
 * DAMAGED/DESTROYED (write layer): grey the whole tone. The header goes flat
 * grey; sub-header + footer + frame use the darker grey shade.
 *
 * FOREGROUNDS go by WCAG contrast against the band actually painted
 * (`onToneText`), for every card: a solid tone, a ghosted host tone, the
 * damaged grey. "Solid tones read paper" was the rule until it measured 1.79:1
 * on TL1, 2.41:1 on pilot and 3.03:1 on mech. The header's foreground serves
 * every on-header element (title, flavor hint, shortform name); the deep
 * band's serves the sub-header and the footer.
 */
export function resolveCardColors({
  tone,
  isDown,
  isGhosted,
  hostTone,
}: {
  tone: DomainTone
  isDown: boolean
  isGhosted: boolean
  hostTone: string | undefined
}): CardColors {
  const greyDeep = accentDeepColor(undefined, GREY_HEADER) ?? 'var(--color-ink)'
  const ghost = isGhosted ? ghostActionTone(hostTone ?? 'var(--color-ink)') : undefined
  // ACTIONS wear the GHOSTED host tone on their HEADER band; their body stays
  // paper/ink like an entity, only the bands are off-colour. Entities use their
  // own medium tone on the header.
  const headerBg = isDown || isGhosted ? undefined : tone.bg
  const headerBgColor = isDown ? GREY_HEADER : ghost ? ghost.header : tone.bgColor
  const darkTone = isDown
    ? greyDeep
    : ghost
      ? ghost.sub
      : (accentDeepColor(tone.bg, tone.bgColor) ?? 'var(--color-ink)')
  // Only for a band the arithmetic cannot resolve (a caller's raw colour): the
  // ghosted and grey bands are light, a solid tone is not.
  const unresolved = isDown || isGhosted ? 'text-ink' : 'text-paper'
  return {
    onBandText: onToneText(borderColorFromHeaderBg(headerBg, headerBgColor), unresolved),
    headerBg,
    headerBgColor,
    darkTone,
    onDarkText: onToneText(darkTone, unresolved),
    frameColor: isDown
      ? greyDeep
      : ghost
        ? ghost.frame
        : (borderColorFromHeaderBg(tone.bg, tone.bgColor) ?? 'var(--color-ink)'),
    ownToneBase: borderColorFromHeaderBg(tone.bg, tone.bgColor) ?? 'var(--color-ink)',
  }
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
  cardStyle,
  selectionRole,
  cardClickLabel,
  selected,
  frameColor,
}: {
  onCardClick: (() => void) | undefined
  controls: ReferenceEntityControl[] | undefined
  cardClickable: boolean | undefined
  disabled: boolean | undefined
  selectable: boolean | undefined
  className: string | undefined
  cardStyle: { className?: string } | undefined
  selectionRole: 'toggle' | 'radio' | undefined
  cardClickLabel: string | undefined
  selected: boolean | undefined
  frameColor: string
}): {
  outer: CardOuterProps
  frameStyle: CSSProperties
} {
  const resolvedCardClick = onCardClick ?? controls?.find((c) => c.cardClick)?.onClick
  const isHoverable = !!resolvedCardClick || !!cardClickable
  const outerClassName = cn(
    'relative flex flex-col overflow-visible',
    disabled && 'opacity-50',
    selectable === false && 'opacity-50 saturate-50',
    isHoverable &&
      'cursor-pointer transition-all duration-200 md:hover:z-10 md:hover:-translate-y-0.5 md:hover:scale-[1.02]',
    resolvedCardClick && FOCUS_RING,
    className,
    cardStyle?.className
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
  // Selection state — the canonical rust SELECTION_RING (chrome/interaction.ts),
  // the same 3px rust border the wizard Sel/PickCard draw. A non-layout-shifting
  // box-shadow that reads as a border, sitting just outside the 3px tone frame.
  // Longhands only, widths per side: the card overrides `borderBottomWidth` on
  // footless renders, and React warns when a shorthand covers a longhand that changes.
  const frame: CSSProperties = {
    borderStyle: 'solid',
    borderColor: frameColor,
    borderTopWidth: '3px',
    borderRightWidth: '3px',
    borderBottomWidth: '3px',
    borderLeftWidth: '3px',
  }
  const frameStyle = selected ? { ...frame, boxShadow: '0 0 0 3px var(--color-rust)' } : frame
  return { outer, frameStyle }
}

/**
 * The header's top-right hint and, for the titanic meta-action, the body it
 * leaves behind.
 *
 * - ABILITY flavor — the short description, in the header's top-right
 *   (abilities have no numeric vitals, so the axis is free for it).
 * - TITANIC: the intro paragraph becomes the hint; the REMAINING content
 *   blocks (the options list) render in the body.
 * - A pattern LISTING row shows its first paragraph.
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
