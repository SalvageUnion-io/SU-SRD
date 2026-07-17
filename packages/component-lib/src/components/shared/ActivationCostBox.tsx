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
          // py-0.5 matches the pseudoheader datavalue tags (TURN ACTION, …) so
          // the AP badge box is the same height as the other datavalue cells.
          'z-[2] inline-flex items-center justify-center whitespace-nowrap bg-ink py-0.5 uppercase leading-none text-paper',
          // Match the datavalue tags' weight (font-normal compact / semibold)
          compact ? 'px-1 text-xs font-normal' : 'px-1.5 text-sm font-semibold'
        )}
        style={{ lineHeight: 1 }}
      >
        {`${displayCost} ${currency}`}
      </span>
      <span
        className="z-[1] ml-0 h-0 w-0 self-center"
        aria-hidden="true"
        style={{
          // Pennant tip spans the full box height (font + 2×py-0.5) so the
          // arrow matches the box and the neighbouring datavalue tags.
          borderTop: compact ? '8px solid transparent' : '9px solid transparent',
          borderBottom: compact ? '8px solid transparent' : '9px solid transparent',
          borderLeft: compact ? '7px solid var(--color-ink)' : '8px solid var(--color-ink)',
        }}
      />
    </span>
  )
}
