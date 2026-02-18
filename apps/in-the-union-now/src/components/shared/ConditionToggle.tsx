import type { ItemCondition } from 'salvageunion-reference'
import type { ReferenceEntityControl } from 'suref-react'

const CONDITION_CYCLE: ItemCondition[] = ['intact', 'damaged', 'destroyed']

const CONDITION_STYLES: Record<
  ItemCondition,
  { bg: string; border: string; hover: string; label: string }
> = {
  intact: {
    bg: 'bg-su-green/80',
    border: 'border-su-green/80',
    hover: 'hover:bg-su-green/60',
    label: 'Intact',
  },
  damaged: {
    bg: 'bg-su-orange/80',
    border: 'border-su-orange/80',
    hover: 'hover:bg-su-orange/60',
    label: 'Damaged',
  },
  destroyed: {
    bg: 'bg-su-rust/80',
    border: 'border-su-rust/80',
    hover: 'hover:bg-su-rust/60',
    label: 'Destroyed',
  },
}

function getNextCondition(condition: ItemCondition): ItemCondition {
  const nextIndex = (CONDITION_CYCLE.indexOf(condition) + 1) % CONDITION_CYCLE.length
  return CONDITION_CYCLE[nextIndex] ?? 'intact'
}

const EmptyIcon = () => null

export function makeConditionControl(
  condition: ItemCondition,
  onChange: (condition: ItemCondition) => void,
  disabled?: boolean
): ReferenceEntityControl {
  const style = CONDITION_STYLES[condition]
  const next = getNextCondition(condition)
  const nextLabel = CONDITION_STYLES[next].label

  return {
    key: 'condition',
    icon: EmptyIcon,
    onClick: disabled ? () => {} : () => onChange(next),
    ariaLabel: disabled ? `Condition: ${style.label}` : `Click to change to ${nextLabel}`,
    variant: 'primary',
    label: style.label,
    className: `${style.bg} text-su-white ${style.border} ${style.hover}${disabled ? ' cursor-not-allowed opacity-50' : ''}`,
  }
}
