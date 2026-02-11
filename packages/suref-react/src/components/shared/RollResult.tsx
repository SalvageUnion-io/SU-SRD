import { cn } from '../../utils/cn'

type RollResultProps = {
  value: number
  tier: string
  tierColor: string
  context?: string
  pushed?: boolean
  compact?: boolean
}

export function RollResult({
  value,
  tier,
  tierColor,
  context,
  pushed,
  compact = false,
}: RollResultProps) {
  return (
    <div className={cn('text-center', compact && 'flex items-center gap-2 text-left')}>
      <div
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-bold',
          tierColor,
          compact ? 'h-8 w-8 text-lg' : 'h-16 w-16 text-3xl'
        )}
      >
        {value}
      </div>
      <div>
        <p className={cn('font-bold', tierColor, compact ? 'text-sm' : 'mt-2 text-lg')}>{tier}</p>
        {pushed && <span className="text-xs font-medium text-heat-critical">PUSHED</span>}
        {context && !compact && <p className="mt-1 text-xs text-su-grey-dark">{context}</p>}
      </div>
    </div>
  )
}
