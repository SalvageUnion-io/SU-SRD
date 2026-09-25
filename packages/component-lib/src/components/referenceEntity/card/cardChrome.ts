/**
 * The card's CHROME rules — how a card is coloured, framed and interacted
 * with, and what its header hint says, as opposed to the content it carries.
 * Split out of `ReferenceEntityCard.tsx` (audit PK-08); every function here is
 * pure. The nodes they feed are `CardTopRail` and `HeaderHint`.
 */

import type { CSSProperties, HTMLAttributes } from 'react'
import type { SURefMetaEntity, SURefObjectContentBlock } from 'salvageunion-reference'
import { isAbility, parseContentBlockString } from 'salvageunion-reference'
import { cn } from '../../../utils/cn'
import { activateOnKey, FOCUS_RING } from '../../chrome/interaction'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'
import { accentDeepColor, borderColorFromHeaderBg } from '../referenceEntityHelpers'
import type { DomainTone } from './entityCardTone'
import { ghostActionTone } from './entityCardTone'
import { firstParagraphText } from './firstParagraphText'

/** The flat grey header of a damaged/destroyed card: ink half-mixed into paper —
 * the same warm material at distance. */
const GREY_HEADER = 'color-mix(in srgb, var(--color-ink) 50%, var(--color-paper))'

/** Every colour a card's bands and frame take. */
export type CardColors = {
  /** The ONE foreground for the header band — see `resolveCardColors`. */
  onBandText: 'text-ink' | 'text-paper'
  headerBg: string | undefined
  headerBgColor: string | undefined
  /** Sub-header + footer band. */
  darkTone: string
  frameColor: string
  /** This entity's own tone base — threaded to its nested action cards as their host. */
  ownToneBase: string
}

/**
 * ACTIONS and NESTED NPCs inherit the summoning (parent) entity's tone,
 * GHOSTED (D8): the header + sub-header bands + 3px frame use the ghosted host
 * tone; the body stays paper/ink. A standalone action (no host) falls back to a
 * neutral base.
 *
 * DAMAGED/DESTROYED (write layer): grey the whole tone. The header goes flat
 * grey; sub-header + footer + frame use the darker grey shade.
 *
 * The header FOREGROUND: a solid-tone card — a real ENTITY or a PATTERN —
 * always reads WHITE (paper). Everything else goes by CONTRAST against its
 * actual band: the light-faded ghosted actions/NPCs and the damaged-grey state
 * all carry light bands, so contrast resolves to ink. Every on-band text
 * element (the title, the flavor hint, the shortform name) uses it.
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
  return {
    onBandText: isDown || isGhosted ? 'text-ink' : 'text-paper',
    // ACTIONS wear the GHOSTED host tone on their HEADER band; their body stays
    // paper/ink like an entity, only the bands are off-colour. Entities use their
    // own medium tone on the header.
    headerBg: isDown || isGhosted ? undefined : tone.bg,
    headerBgColor: isDown ? GREY_HEADER : ghost ? ghost.header : tone.bgColor,
    darkTone: isDown
      ? greyDeep
      : ghost
        ? ghost.sub
        : (accentDeepColor(tone.bg, tone.bgColor) ?? 'var(--color-ink)'),
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
  outerClassName: string
  outerInteraction: HTMLAttributes<HTMLDivElement>
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
  // Base a11y for a clickable card. A selection toggle (selectionRole set)
  // additionally announces its state: radio → role=radio + aria-checked, toggle
  // → aria-pressed. `cardClickLabel` gives the wrapper an accessible name (the
  // entity title) instead of its full text content. Navigation/add cards leave
  // both unset and stay a plain role=button, byte-identical to before.
  const outerInteraction = resolvedCardClick
    ? {
        role: selectionRole === 'radio' ? ('radio' as const) : ('button' as const),
        tabIndex: 0,
        onClick: resolvedCardClick,
        onKeyDown: activateOnKey(resolvedCardClick),
        ...(cardClickLabel ? { 'aria-label': cardClickLabel } : {}),
        ...(selectionRole && selected !== undefined
          ? selectionRole === 'radio'
            ? { 'aria-checked': selected }
            : { 'aria-pressed': selected }
          : {}),
      }
    : {}
  // Selection state — the canonical rust SELECTION_RING (chrome/interaction.ts),
  // the same 3px rust border the wizard Sel/PickCard draw. A non-layout-shifting
  // box-shadow that reads as a border, sitting just outside the 3px tone frame.
  const frameStyle = selected
    ? { border: `3px solid ${frameColor}`, boxShadow: '0 0 0 3px var(--color-rust)' }
    : { border: `3px solid ${frameColor}` }
  return { outerClassName, outerInteraction, frameStyle }
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
