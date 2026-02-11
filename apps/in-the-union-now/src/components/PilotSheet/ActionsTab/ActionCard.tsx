import { useState } from 'react'
import { ChevronDown, Dice5 } from 'lucide-react'
import { cn, ConditionControl } from 'suref-react'
import { useDiceStore } from '../../../stores/diceStore'
import type { ItemCondition } from '../../../types/common'

type ActionCardProps = {
  name: string
  description?: string
  actionType?: string
  source?: string
  apCost?: number
  epCost?: number
  range?: string
  damage?: string
  condition?: ItemCondition
  onConditionChange?: (condition: ItemCondition) => void
  traits?: string[]
}

const actionTypeColors: Record<string, string> = {
  reaction: 'bg-roll-cascade/20 text-roll-cascade',
  free: 'bg-roll-success/20 text-roll-success',
  turn: 'bg-roll-nailed/20 text-roll-nailed',
  short: 'bg-pilot/20 text-pilot',
  long: 'bg-su-grey/20 text-su-grey-dark',
  downtime: 'bg-crawler/20 text-crawler',
}

export function ActionCard({
  name,
  description,
  actionType,
  source,
  apCost,
  epCost,
  range,
  damage,
  condition,
  onConditionChange,
  traits,
}: ActionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const roll = useDiceStore((s) => s.roll)

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--border)] transition-colors',
        condition === 'destroyed' && 'opacity-40'
      )}
    >
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        {condition && onConditionChange && (
          <ConditionControl condition={condition} onChange={onConditionChange} compact />
        )}

        <span className="flex-1 text-sm font-medium">{name}</span>

        {actionType && (
          <span
            className={cn(
              'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
              actionTypeColors[actionType.toLowerCase()] ?? 'bg-su-grey-light/20'
            )}
          >
            {actionType}
          </span>
        )}

        {apCost !== undefined && apCost > 0 && (
          <span className="shrink-0 text-xs font-bold text-pilot">{apCost}AP</span>
        )}
        {epCost !== undefined && epCost > 0 && (
          <span className="shrink-0 text-xs font-bold text-su-blue">{epCost}EP</span>
        )}

        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-su-grey transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[var(--border)] px-3 py-3">
          {source && (
            <p className="mb-1 text-[10px] font-medium uppercase text-su-grey">{source}</p>
          )}

          {description && (
            <p className="mb-2 text-xs leading-relaxed text-su-grey-dark">{description}</p>
          )}

          {(range || damage) && (
            <div className="mb-2 flex gap-3 text-xs">
              {range && (
                <span>
                  Range: <span className="font-medium">{range}</span>
                </span>
              )}
              {damage && (
                <span>
                  Damage: <span className="font-medium">{damage}</span>
                </span>
              )}
            </div>
          )}

          {traits && traits.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {traits.map((trait) => (
                <span key={trait} className="rounded bg-su-grey-light/20 px-1.5 py-0.5 text-[10px]">
                  {trait}
                </span>
              ))}
            </div>
          )}

          {condition && onConditionChange && (
            <div className="mb-3">
              <ConditionControl condition={condition} onChange={onConditionChange} />
            </div>
          )}

          <button
            onClick={() => roll(name)}
            className="flex items-center gap-1.5 rounded-md bg-pilot/10 px-3 py-1.5 text-xs font-medium text-pilot transition-colors hover:bg-pilot/20"
          >
            <Dice5 className="h-3.5 w-3.5" />
            Roll for this
          </button>
        </div>
      )}
    </div>
  )
}
