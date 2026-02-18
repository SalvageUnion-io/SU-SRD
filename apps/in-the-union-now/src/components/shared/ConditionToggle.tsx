import type { ItemCondition } from 'salvageunion-reference'

const CONDITION_CYCLE: ItemCondition[] = ['intact', 'damaged', 'destroyed']

const CONDITION_STYLES: Record<ItemCondition, { bg: string; text: string; label: string }> = {
  intact: { bg: 'bg-su-green/80', text: 'text-su-white', label: 'Intact' },
  damaged: { bg: 'bg-su-orange/80', text: 'text-su-white', label: 'Damaged' },
  destroyed: { bg: 'bg-su-rust/80', text: 'text-su-white', label: 'Destroyed' },
}

type ConditionToggleProps = {
  condition: ItemCondition
  onChange: (condition: ItemCondition) => void
  disabled?: boolean
}

export function ConditionToggle({ condition, onChange, disabled }: ConditionToggleProps) {
  const style = CONDITION_STYLES[condition]
  const nextIndex = (CONDITION_CYCLE.indexOf(condition) + 1) % CONDITION_CYCLE.length
  const next = CONDITION_CYCLE[nextIndex] ?? 'intact'

  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      disabled={disabled}
      className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase transition-colors ${style.bg} ${style.text} ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:opacity-80'
      }`}
      title={`Click to change to ${CONDITION_STYLES[next].label}`}
    >
      {style.label}
    </button>
  )
}
