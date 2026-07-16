import type { CSSProperties, ReactNode } from 'react'
import type { SURefEnumSchemaName, SURefMetaAction, SURefMetaEntity } from 'salvageunion-reference'
import { resolveActivationCurrency } from 'salvageunion-reference'
import { cn } from '../../../utils/cn'
import { Text } from '../../base/Text'
import { Glyph } from '../../chrome/glyphs'
import { Stamp } from '../../chrome/Stamp'
import { STAMP_SEAM } from '../../chrome/stampSeam'
import { ActivationCostBox } from '../../shared/ActivationCostBox'
import { StatDisplay } from '../../shared/StatDisplay'
import { accentDeepColor, accentSurface, borderColorFromHeaderBg } from '../referenceEntityHelpers'
import { resolveDomainTone } from './newCardTone'

import type { ActionDirection } from './ActionDirectionsSpec'

/**
 * DESIGN EXPLORATION — six candidate "action tells" (specs + rationale in
 * `ActionDirectionsSpec.ts`; comparison story in `ActionDirections.stories.tsx`).
 *
 * Every direction keeps the entity card's four-band family shape (seam /
 * header / sub-header / body) and the HOST entity's own tone family — no rust
 * band split — adding ONE distinguishing mark instead.
 *
 * Story-local design sketches, deliberately self-contained: they compose the
 * real primitives (Stamp, Glyph, ActivationCostBox, StatDisplay) but
 * hand-author only the tell under exploration. Nothing here is production API.
 */

/** Fine 135° ink hatch layered OVER the tone band (D6) — texture, not a new colour. */
const HATCH_TEXTURE =
  'repeating-linear-gradient(135deg, rgba(28, 24, 18, 0.12) 0px, rgba(28, 24, 18, 0.12) 1px, transparent 1px, transparent 5px)'

/** Corner-bracket arm (D3): 14px ink L-shapes pinned over the hairline frame. */
const BRACKET = 'pointer-events-none absolute z-[5] h-3.5 w-3.5 border-ink'

/**
 * The DRAMATIC band colours (D7–D10). Each keeps the four-band shape but swaps
 * in a bolder colour scheme: a unique light action hue, a washed-out host tone,
 * an airy pale wash, or paper bands with a bold action spine. `hostBase` is the
 * host entity's own tone as a resolvable CSS colour (a `var(--color-…)` /
 * rgb()), so the ghost/wash variants derive from the entity's real colour.
 */
type ActionBands = {
  /** Header band fill. */
  header: string
  /** Sub-header band fill (a step off the header). */
  sub: string
  /** Card body fill (defaults to paper when omitted). */
  body?: string
  /** Frame colour. */
  frame: string
  /** Optional bold left spine colour (D10). */
  spine?: string
}

/** A light steel-blue — the unique "action" hue (D7/D10): not rust, not a host tone, not dark. */
const ACTION_STEEL = 'rgb(203, 213, 221)'
const ACTION_STEEL_SUB = 'rgb(176, 190, 201)'
const ACTION_STEEL_FRAME = 'rgb(92, 114, 131)'

function resolveActionBands(direction: ActionDirection, hostBase: string): ActionBands | undefined {
  switch (direction) {
    case 'action-colour':
      return { header: ACTION_STEEL, sub: ACTION_STEEL_SUB, frame: ACTION_STEEL_FRAME }
    case 'ghosted':
      // Desaturate + lighten the host tone toward a warm grey.
      return {
        header: `color-mix(in srgb, ${hostBase} 32%, rgb(233, 230, 222))`,
        sub: `color-mix(in srgb, ${hostBase} 46%, rgb(233, 230, 222))`,
        frame: `color-mix(in srgb, ${hostBase} 55%, rgb(184, 178, 165))`,
      }
    case 'light-wash':
      // A very pale tint of the tone floods the whole card; header a step deeper.
      return {
        header: `color-mix(in srgb, ${hostBase} 24%, white)`,
        sub: `color-mix(in srgb, ${hostBase} 16%, white)`,
        body: `color-mix(in srgb, ${hostBase} 7%, white)`,
        frame: `color-mix(in srgb, ${hostBase} 45%, white)`,
      }
    case 'action-spine':
      // Paper-pale bands, a bold steel spine + frame down the left edge.
      return {
        header: 'rgb(226, 231, 235)',
        sub: 'rgb(214, 221, 226)',
        frame: ACTION_STEEL_FRAME,
        spine: ACTION_STEEL_FRAME,
      }
    default:
      return undefined
  }
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1)
}

type SubHeaderCell = { key: string; label: string; value?: string }

/** Range / damage / traits → the family's sub-header `[label | value]` cells. */
function actionSubHeaderCells(action: SURefMetaAction): SubHeaderCell[] {
  const cells: SubHeaderCell[] = []
  if (action.range && action.range.length > 0) {
    cells.push({ key: 'range', label: 'Range', value: action.range.join(' / ') })
  }
  if (action.damage) {
    cells.push({
      key: 'damage',
      label: 'Damage',
      value: `${action.damage.amount}${action.damage.damageType ?? ''}`,
    })
  }
  for (const trait of action.traits ?? []) {
    cells.push({
      key: `trait-${trait.type}`,
      label: capitalize(trait.type),
      value: trait.amount != null ? String(trait.amount) : undefined,
    })
  }
  return cells
}

type ActionDirectionCardProps = {
  /** The real action being explored (same one across every direction). */
  action: SURefMetaAction
  /** The entity that owns the action — the card borrows ITS tone family. */
  host: SURefMetaEntity
  hostSchema: SURefEnumSchemaName
  direction: ActionDirection
  className?: string
}

/**
 * ActionDirectionCard — ONE action rendered in the entity card's four-band
 * family shape (seam / header / sub-header / body), with the single
 * distinguishing tell selected by `direction`. The tone is the HOST entity's
 * (no rust band split); compact scale matches a nested (depth 1) family card.
 */
export function ActionDirectionCard({
  action,
  host,
  hostSchema,
  direction,
  className,
}: ActionDirectionCardProps) {
  const tone = resolveDomainTone(hostSchema, host)
  const accent = accentSurface(tone.bg, tone.bgColor)
  const darkTone = accentDeepColor(tone.bg, tone.bgColor) ?? 'var(--color-su-black)'
  const frameColor = borderColorFromHeaderBg(tone.bg, tone.bgColor) ?? 'var(--color-su-black)'
  // DRAMATIC directions (D7–D10) override the host-tone bands with a bolder
  // colour scheme derived from the host's own tone as a CSS colour.
  const hostBase = frameColor
  const bands = resolveActionBands(direction, hostBase)
  const currency = resolveActivationCurrency(action.actionSource)
  const typeLabel = action.actionType ? `${action.actionType} Action` : 'Action'
  const cells = actionSubHeaderCells(action)
  const paragraphs = (action.content ?? []).flatMap((block) =>
    typeof block.value === 'string' ? [block.value] : []
  )

  // SEAM — the family's border-riding type stamp; D1 adds the glyph chip,
  // D5 swaps in the enlarged inverted plate.
  const seam = (
    <div className={cn(STAMP_SEAM, 'left-3 flex items-center gap-1.5')}>
      {direction === 'glyph-badge' && (
        <span className="flex h-5 w-5 items-center justify-center bg-ink text-paper">
          <Glyph name="gear" title="Action" className="h-3.5 w-3.5" />
        </span>
      )}
      {direction === 'seam-stamp' ? (
        <Stamp size="lg" surface="inverse" className="ring-2">
          {typeLabel}
        </Stamp>
      ) : (
        <Stamp size="sm">{typeLabel}</Stamp>
      )}
    </div>
  )

  // HEADER — the family's black name-tab on the host tone band. D2 moves the
  // cost pennant to a full-size LEADING position; everyone else keeps the
  // compact pennant on the right axis. D4 underlines the name-tab in rust.
  const nameTab = (
    <Text
      variant="pseudoheader"
      as="span"
      className="w-fit self-center font-cond text-xl font-bold uppercase leading-none tracking-caps-tight"
    >
      {action.name}
    </Text>
  )
  const costBox: ReactNode =
    action.activationCost != null ? (
      <ActivationCostBox
        cost={action.activationCost}
        currency={currency}
        compact={direction !== 'cost-led'}
      />
    ) : undefined

  const headerStyle: CSSProperties | undefined = bands
    ? { backgroundColor: bands.header }
    : direction === 'textured-band'
      ? { ...(accent.style ?? {}), backgroundImage: HATCH_TEXTURE }
      : accent.style

  const header = (
    <div
      className={cn(
        'flex w-full min-w-0 items-center gap-3 px-2.5 py-1.5',
        bands ? undefined : accent.className
      )}
      style={headerStyle}
    >
      {direction === 'cost-led' && costBox}
      {direction === 'hairline-rule' ? (
        <span
          className="w-fit self-center pb-1"
          style={{ borderBottom: '2px solid var(--color-su-rust)' }}
        >
          {nameTab}
        </span>
      ) : (
        nameTab
      )}
      {direction !== 'cost-led' && costBox && (
        <div className="ml-auto flex shrink-0 items-center justify-end gap-2">{costBox}</div>
      )}
    </div>
  )

  // FRAME — D3 trades the family's plain 3px frame for a hairline + brackets;
  // dramatic directions frame in their own band colour, and D10 adds a bold spine.
  const frameStyle: CSSProperties = bands
    ? {
        border: `2px solid ${bands.frame}`,
        ...(bands.spine ? { borderLeft: `9px solid ${bands.spine}` } : {}),
        ...(bands.body ? { backgroundColor: bands.body } : {}),
      }
    : direction === 'corner-bracket'
      ? { border: `1px solid ${frameColor}` }
      : { border: `3px solid ${frameColor}` }

  return (
    <div className={cn('relative overflow-visible', className)}>
      {seam}
      <div className="overflow-hidden rounded-card bg-paper" style={frameStyle}>
        {header}
        {cells.length > 0 && (
          <div
            className="flex w-full flex-wrap items-center gap-1.5 px-2.5 py-1"
            style={{ backgroundColor: bands ? bands.sub : darkTone }}
          >
            {cells.map((cell) => (
              <StatDisplay
                key={cell.key}
                orientation="horizontal"
                label={cell.label}
                value={cell.value}
                xs
              />
            ))}
          </div>
        )}
        <div className="flex flex-col gap-1.5 p-2">
          {paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="m-0 font-body text-xs leading-snug text-ink">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
      {direction === 'corner-bracket' && (
        <>
          <span
            aria-hidden="true"
            className={cn(BRACKET, '-left-px -top-px border-l-[3px] border-t-[3px]')}
          />
          <span
            aria-hidden="true"
            className={cn(BRACKET, '-right-px -top-px border-r-[3px] border-t-[3px]')}
          />
          <span
            aria-hidden="true"
            className={cn(BRACKET, '-bottom-px -left-px border-b-[3px] border-l-[3px]')}
          />
          <span
            aria-hidden="true"
            className={cn(BRACKET, '-bottom-px -right-px border-b-[3px] border-r-[3px]')}
          />
        </>
      )}
    </div>
  )
}
