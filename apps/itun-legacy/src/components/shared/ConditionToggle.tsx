import type { ItemCondition } from 'salvageunion-reference'
import type { ReferenceEntityControl } from 'suref-react'

const CONDITION_CYCLE: ItemCondition[] = ['intact', 'damaged', 'destroyed']

const CONDITION_STYLES: Record<
  ItemCondition,
  { label: string; variant: ReferenceEntityControl['variant']; bgColor?: string }
> = {
  intact: {
    label: 'Intact',
    variant: 'primary',
  },
  damaged: {
    label: 'Damaged',
    variant: 'danger',
    bgColor: 'var(--color-su-orange)',
  },
  destroyed: {
    label: 'Destroyed',
    variant: 'danger',
  },
}

function getNextCondition(condition: ItemCondition): ItemCondition {
  const nextIndex = (CONDITION_CYCLE.indexOf(condition) + 1) % CONDITION_CYCLE.length
  return CONDITION_CYCLE[nextIndex] ?? 'intact'
}

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
    label: style.label,
    onClick: () => onChange(next),
    ariaLabel: disabled ? `Condition: ${style.label}` : `Click to change to ${nextLabel}`,
    variant: style.variant,
    bgColor: style.bgColor,
    disabled,
  }
}
