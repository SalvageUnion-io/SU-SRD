import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../../utils/cn'
import { Badge } from '../../chrome/Badge'
import { Stat } from '../../shared/Stat'
import type { StatItem } from '../../shared/statsBarTypes'
import { formatActionType } from './cardCells'
import type { AxisMarker } from './entityCardTone'
import type { ActionFields } from './referenceEntityCardTypes'

/**
 * BADGE — the SHORTFORM token (`size="small" extent="head"`): a single
 * tone-filled pill with the NAME leading, then a classification tail. Reuses
 * the same interaction/frame plumbing as every other size but collapses the
 * whole card to one line.
 *
 * ONE shell for both shortforms: the tone-filled pill (accent surface, 3px
 * frame, whole-card interaction plumbing) with the truncating name leading.
 * The name colour matches the header title everywhere else (`onBandText`):
 * white on the tone band, ink only on the light ghosted/greyed bands. Only the
 * tail cells differ between the action and entity forms.
 */
export function CardShortform({
  outerClassName,
  outerInteraction,
  accent,
  frameStyle,
  onBandText,
  name,
  action,
  costNode,
  axisMarkers,
  techLevel,
}: {
  outerClassName: string
  outerInteraction: HTMLAttributes<HTMLDivElement>
  accent: { className?: string; style?: CSSProperties }
  frameStyle: CSSProperties
  onBandText: string
  name: string
  /** Set when the card IS an action — switches to the action tail. */
  action: ActionFields | undefined
  costNode: ReactNode
  axisMarkers: AxisMarker[]
  techLevel: number | 'B' | 'N' | undefined
}) {
  return (
    <div className={outerClassName} {...outerInteraction}>
      <div
        className={cn(
          'inline-flex max-w-full items-center gap-2 self-start overflow-hidden rounded-card px-2 py-1',
          accent.className
        )}
        style={{ ...accent.style, ...frameStyle }}
      >
        <span
          className={cn(
            'min-w-0 truncate font-cond text-sm font-bold uppercase leading-none tracking-caps-tight',
            onBandText
          )}
        >
          {name}
        </span>
        {action ? (
          <ActionTail action={action} costNode={costNode} />
        ) : (
          <EntityTail axisMarkers={axisMarkers} techLevel={techLevel} />
        )}
      </div>
    </div>
  )
}

/**
 * Action shortform tail: Cost · type · Damage · range (each when present) —
 * the NAME leads (left-aligned so a stack of action badges reads down a name
 * column), then the AP/EP cost pennant, the action type as a stamp, then
 * Damage / Range as [label|value] Stat cells (if relevant).
 */
function ActionTail({ action, costNode }: { action: ActionFields; costNode: ReactNode }) {
  const typeLabel = action.actionType ? formatActionType(action.actionType) : undefined
  const damageValue = action.damage
    ? `${action.damage.amount}${action.damage.damageType ?? ''}`
    : undefined
  const rangeValue = action.range && action.range.length > 0 ? action.range.join(' / ') : undefined
  return (
    <>
      {costNode}
      {typeLabel && (
        <Badge shape="stamp" size="mini">
          {typeLabel}
        </Badge>
      )}
      {damageValue && (
        <Stat
          key="damage"
          orientation="horizontal"
          label="Damage"
          value={damageValue}
          size="mini"
        />
      )}
      {rangeValue && (
        <Stat key="range" orientation="horizontal" label="Range" value={rangeValue} size="mini" />
      )}
    </>
  )
}

/**
 * Entity shortform tail — the classification as Stat cells (matching the
 * sub-header's axis markers): abilities show [Ability Tree | …] [Level | n]; a
 * TL-bearing entity shows [TL | n]; everything else shows nothing.
 */
function EntityTail({
  axisMarkers,
  techLevel,
}: {
  axisMarkers: AxisMarker[]
  techLevel: number | 'B' | 'N' | undefined
}) {
  const badgeStats: StatItem[] =
    axisMarkers.length > 0
      ? axisMarkers.map((m) => ({ key: m.label, label: m.label, value: m.value }))
      : techLevel != null
        ? [{ key: 'tech-level', label: 'TL', value: String(techLevel) }]
        : []
  return badgeStats.map((s) => (
    <Stat key={s.key} orientation="horizontal" label={s.label} value={s.value} size="mini" />
  ))
}
