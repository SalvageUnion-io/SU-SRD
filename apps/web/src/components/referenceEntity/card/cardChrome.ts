/**
 * The card's CHROME rules — how a card is coloured, framed and interacted
 * with, and what its header hint says, as opposed to the content it carries.
 * Split out of `ReferenceEntityCard.tsx`; every function here is
 * pure. The nodes they feed are the card's outer wrapper and its header.
 */

import type { CSSProperties } from 'react'
import type { RefMetaEntity, RefObjectContentBlock } from 'salvageunion-reference'
import { headerFill, isAbility, parseContentBlockString } from 'salvageunion-reference'
import type { Foreground } from '../../../design/contrast'
import { foregroundOn } from '../../../design/contrast'
import { cn } from '../../../lib/cn'
import { activateOnKey, FOCUS_RING } from '../../atoms/interaction'
import type { CardSize } from '../../containers/displayMode'
import { SELECT_DIM, SELECTED_RING } from '../../entity/modes/selectedRing'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'
import { onTone, textBand } from '../referenceEntityHelpers'
import type { CardOuterProps } from './CardOuter'
import type { DomainTone } from './entityCardTone'

/** What the HOMEBREW stamp and a homebrew pill say when hovered (ruleset §3.9). */
export const USER_MADE_TITLE = 'Made by a player, not from the Workshop Manual'

/** What the stamp every player-made thing wears says (`HomebrewStamp`, ruleset §3.9). */
export const HOMEBREW = 'Homebrew'

/** The greys a damaged band dulls toward: ink mixed into paper —
 * the same warm material at distance. A band that prints ink dulls toward the
 * light one and a band that prints paper toward the dark one, so a dulled band
 * keeps its foreground and its contrast (5.2:1 at worst across the palette). */
const DULL_GREY = {
  ink: 'color-mix(in srgb, var(--color-ink) 30%, var(--color-paper))',
  paper: 'color-mix(in srgb, var(--color-ink) 70%, var(--color-paper))',
} as const

/** A DESTROYED band: flat grey, ink half-mixed into paper, whatever its tone. */
export const GREY_HEADER = 'color-mix(in srgb, var(--color-ink) 50%, var(--color-paper))'

/** A DAMAGED band (owner, 2026-10-14): its own colour dulled toward grey, not
 * replaced by it, so it still reads as the same entity. Every form (Mini,
 * Compact, CompactIndex, Card, Peek) dulls the same band the same way. */
export function dullBand(band: string): string {
  return `color-mix(in srgb, ${band} 50%, ${DULL_GREY[foregroundOn(band, 'paper')]})`
}

/** Whether an entity is down, and how: `false` intact, `true` damaged (its
 * band dulls), `'destroyed'` (its band goes flat grey). A host threads it to
 * everything nested under it. */
export type Down = boolean | 'destroyed'

/** The `Down` an instance condition gives. */
export function downOf(condition: string | undefined): Down {
  return condition === 'destroyed' ? 'destroyed' : condition === 'damaged'
}

/** The instance condition a `Down` stands for, for a child drawn under a down host. */
export function conditionOf(down: Down): 'damaged' | 'destroyed' | undefined {
  return down === 'destroyed' ? 'destroyed' : down ? 'damaged' : undefined
}

/** A card's `Down`: destroyed outranks damaged, from its own status or its host's. */
export function cardDown(status: string | undefined, hostDown: Down | undefined): Down {
  if (status === 'destroyed' || hostDown === 'destroyed') return 'destroyed'
  return status === 'damaged' || !!hostDown
}

/** A band as a down entity paints it: grey when destroyed, dulled when damaged. */
export function downBand(band: string, down: Down): string {
  return down === 'destroyed' ? GREY_HEADER : down ? dullBand(band) : band
}

/**
 * The header's two fills (ruleset §5, board E1): a TONE header for things you
 * HAVE (chassis, systems, gear, denizens), an INK header — the book's ink
 * banner — for things you DO (abilities, actions).
 */
export type HeaderFill = 'tone' | 'ink'

/**
 * Which fill a card's header takes, by data shape. Things you do (abilities,
 * actions) are the ink banner on a card. A PEEK's card wears the fill of the
 * Mini, Compact or CompactIndex that opened it, never a different one: an ability's, its
 * tier tone (E12). A head-only card is a Mini, which paints itself.
 */
export function resolveHeaderFill(entity: RefMetaEntity, insidePeek = false): HeaderFill {
  // The entity model's rule (E12), with the Peek as its Compact.
  return headerFill(entity, insidePeek ? 'row' : 'card')
}

/** Every colour a card's header takes. The frame, the "//" line and the footer
 * are ink on paper on every card, so they need no colour of their own (a
 * Peek's footer borrows the band, see `EntityCardIdentityFooter`). */
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
 * - DAMAGED (write layer): the band dulls toward grey (`dullBand`), keeping its
 *   foreground. DESTROYED: flat grey (`GREY_HEADER`), whatever the fill.
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
  isDown: Down
  fill: HeaderFill
}): CardColors {
  if (fill === 'ink') {
    if (!isDown) return { onBand: 'paper', bandColor: 'var(--color-ink)' }
    const dulled = downBand('var(--color-ink)', isDown)
    return { onBand: onTone(dulled, 'paper'), bandColor: dulled }
  }
  // A tone that carries neither foreground at 4.5:1 paints its deeper text
  // band instead (ruleset §3.8): crawler pink becomes the crawler band, paper text.
  const band = textBand(tone.bgColor ?? tone.bg)
  if (!isDown) return { onBand: onTone(tone.bgColor ?? tone.bg, 'paper'), bandColor: band }
  // A band left paper dulls from paper.
  const dulled = downBand(band ?? 'var(--color-paper)', isDown)
  return { onBand: onTone(dulled, 'paper'), bandColor: dulled }
}

/**
 * The frame's weight. It steps with size (ruleset §4.3, board E2): 3px for
 * the large solo card, 2px one size down, 1.5px for a small card (and a
 * head-only card's Mini).
 */
export function resolveFrameWidth(size: CardSize): string {
  if (size === 'mini') return 'var(--bw-chrome)'
  return size === 'full' ? 'var(--bw-entity)' : 'var(--bw-entity-compact)'
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
  // these (`.su-ec-outer` in `styles/partials/reference-card.css`).
  const outerClassName = cn(
    'su-ec-outer',
    disabled && 'su-ec-outer--dim',
    selectable === false && SELECT_DIM,
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
  // A DISCLOSURE control in the card's head (the fold chevron) controls the
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
                  // A hidden disclosure control (a chevron-less folded Compact)
                  // hands its name and state to the card that now stands in for it.
                  ...(clickControl?.hidden && clickControl.ariaExpanded !== undefined
                    ? {
                        'aria-expanded': clickControl.ariaExpanded,
                        ...(cardClickLabel ? {} : { 'aria-label': clickControl.ariaLabel }),
                      }
                    : {}),
                  ...(selectionRole && selected !== undefined ? { 'aria-pressed': selected } : {}),
                },
        }
  // Selection state — select mode's ring (`SELECTED_RING`), the same 3px ink
  // ring a selected Compact and a select-mode Box draw. A non-layout-shifting
  // box-shadow that reads as a border, sitting just outside the frame.
  // The frame is the subtle ink-40 on every card (R38), a user-made one too
  // (owner's call, 2026-10-20: its HOMEBREW chip marks it); the tone lives in
  // the header band alone. Longhands, so a caller overriding one side
  // never trips React's shorthand/longhand warning.
  const frame = {
    borderStyle: 'solid',
    borderColor: 'var(--color-ink-40)',
    borderTopWidth: frameWidth,
    borderRightWidth: frameWidth,
    borderBottomWidth: frameWidth,
    borderLeftWidth: frameWidth,
  } satisfies CSSProperties
  const frameStyle = selected ? { ...frame, ...SELECTED_RING } : frame
  return { outer, frameStyle }
}

/**
 * The card's hint text and, for the titanic meta-action, the body it leaves
 * behind.
 *
 * - ABILITY flavor — the short description. An ability is an ink banner now
 *   (tier numeral, title, cost chip), so the card prints it as the body's
 *   lead rather than on the band.
 * - TITANIC: the intro paragraph becomes the hint; the REMAINING content
 *   blocks (the options list) render in the body.
 */
export function resolveHeaderHint(
  entity: RefMetaEntity,
  { isTitanicMeta }: { isTitanicMeta: boolean }
): { hintText: string | undefined; titanicBodyContent: RefObjectContentBlock[] | undefined } {
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
  return {
    hintText: description ?? (titanicHintText || undefined),
    titanicBodyContent,
  }
}
