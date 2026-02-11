import { useState, useEffect } from 'react'
import { cn } from '../../utils/cn'
import { Text } from '../base/Text'
import { Tooltip } from '../ui/tooltip'

type StatDisplayProps = {
  label: string
  value: number | string | undefined
  outOfMax?: number
  bottomLabel?: string
  labelId?: string
  disabled?: boolean
  onClick?: () => void
  bg?: string
  valueColor?: string
  borderColor?: string
  ariaLabel?: string
  compact?: boolean
  flash?: boolean
  inverse?: boolean
  isOverMax?: boolean
  hoverText?: string
}

export function StatDisplay({
  label,
  value,
  outOfMax,
  bottomLabel,
  labelId,
  disabled,
  onClick,
  bg = 'bg-su-white',
  valueColor = 'text-su-black',
  borderColor = 'border-su-black',
  ariaLabel,
  compact = false,
  flash = false,
  inverse = false,
  isOverMax = false,
  hoverText,
}: StatDisplayProps) {
  const [isFlashing, setIsFlashing] = useState(false)

  const combinedAriaLabel = ariaLabel || (bottomLabel ? `${label} ${bottomLabel}` : label)
  const trueBg = inverse ? 'bg-su-black' : bg
  const trueValueColor = inverse ? 'text-su-white' : valueColor
  const trueBorderColor = isOverMax ? 'border-su-green' : borderColor

  useEffect(() => {
    if (!flash) return
    const startTimer = setTimeout(() => setIsFlashing(true), 0)
    const endTimer = setTimeout(() => setIsFlashing(false), 3000)
    return () => {
      clearTimeout(startTimer)
      clearTimeout(endTimer)
    }
  }, [flash])

  if (value === undefined) return null

  const boxSize = compact ? 'h-8 w-8' : 'h-12 w-12'

  const content = (
    <div className="flex flex-col items-center gap-0" aria-label={combinedAriaLabel}>
      <Text
        variant="pseudoheader"
        as="span"
        className={cn(
          'z-[1] -mb-2 self-center whitespace-nowrap uppercase',
          compact ? 'text-[10px]' : 'text-xs'
        )}
        id={labelId}
      >
        {label}
      </Text>
      {onClick ? (
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'flex items-center justify-center border',
            boxSize,
            trueBg,
            trueBorderColor,
            compact ? 'border' : 'border-[1.5px]',
            disabled ? 'pointer-events-none' : 'cursor-pointer hover:opacity-80',
            isFlashing && 'animate-[growShrink_3s_ease-out]'
          )}
          aria-label={combinedAriaLabel}
        >
          <span
            className={cn(
              'w-full overflow-hidden whitespace-nowrap text-center font-bold',
              trueValueColor,
              compact ? 'text-xs' : 'text-[0.85rem]'
            )}
          >
            {outOfMax !== undefined ? `${value}/${outOfMax}` : value}
          </span>
        </button>
      ) : (
        <div
          className={cn(
            'flex items-center justify-center border',
            boxSize,
            trueBg,
            trueBorderColor,
            compact ? 'border' : 'border-[1.5px]',
            isFlashing && 'animate-[growShrink_3s_ease-out]'
          )}
        >
          <span
            className={cn(
              'w-full overflow-hidden whitespace-nowrap text-center font-bold',
              trueValueColor,
              compact ? 'text-xs' : 'text-[0.85rem]'
            )}
          >
            {outOfMax !== undefined ? `${value}/${outOfMax}` : value}
          </span>
        </div>
      )}
      <Text
        variant="pseudoheader"
        as="span"
        className={cn(
          'z-[1] -mt-2 self-center uppercase',
          compact ? 'text-[10px]' : 'text-xs',
          !bottomLabel && 'invisible'
        )}
      >
        {bottomLabel || '\u00A0'}
      </Text>
    </div>
  )

  if (hoverText) {
    return <Tooltip content={hoverText}>{content}</Tooltip>
  }

  return content
}
