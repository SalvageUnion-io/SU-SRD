import { Flame } from 'lucide-react'
import type { ItemCondition } from 'salvageunion-reference'
import type { ReferenceEntityControl } from 'suref-react'

const CONDITION_CYCLE: ItemCondition[] = ['intact', 'damaged', 'destroyed']

const CONDITION_STYLES: Record<
  ItemCondition,
  { className: string; label: string; variant: ReferenceEntityControl['variant'] }
> = {
  intact: {
    className: undefined as unknown as string,
    label: 'Intact',
    variant: 'ghost',
  },
  damaged: {
    className: 'bg-su-orange text-su-white opacity-100',
    label: 'Damaged',
    variant: 'danger',
  },
  destroyed: {
    className: 'bg-su-rust text-su-white opacity-100',
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
    icon: Flame,
    onClick: disabled ? () => {} : () => onChange(next),
    ariaLabel: disabled ? `Condition: ${style.label}` : `Click to change to ${nextLabel}`,
    variant: style.variant,
    className:
      `${style.className ?? ''}${disabled ? ' cursor-not-allowed opacity-50' : ''}`.trim() ||
      undefined,
  }
}
