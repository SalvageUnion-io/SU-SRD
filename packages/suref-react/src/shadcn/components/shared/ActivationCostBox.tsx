import { cn } from '../../utils/cn'

type ActivationCostBoxProps = {
  cost: string | number
  currency?: string | undefined | number
  compact?: boolean
}

export function ActivationCostBox({
  cost,
  currency = 'AP',
  compact = false,
}: ActivationCostBoxProps) {
  if (cost === undefined) return null
  const displayCost = cost === 'Variable' ? 'X' : cost

  return (
    <span className="inline-flex items-center overflow-visible p-0">
      <span
        className={cn(
          'z-[2] inline-flex items-center justify-center whitespace-nowrap bg-su-black font-bold uppercase leading-none text-su-white',
          compact ? 'px-0.5 text-xs' : 'px-0.5 text-base'
        )}
        style={{ lineHeight: 1 }}
      >
        {`${displayCost} ${currency}`}
      </span>
      <span
        className="z-[1] ml-0 h-0 w-0 self-center"
        style={{
          borderTop: compact ? '0.4em solid transparent' : '7px solid transparent',
          borderBottom: compact ? '0.4em solid transparent' : '7px solid transparent',
          borderLeft: compact ? '6px solid rgb(40, 32, 25)' : '7px solid rgb(40, 32, 25)',
        }}
      />
    </span>
  )
}
