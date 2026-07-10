import { useState, useEffect, useRef, useCallback } from 'react'
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

  const boxRef = useRef<HTMLDivElement>(null)
  const topLabelRef = useRef<HTMLSpanElement>(null)
  const bottomLabelRef = useRef<HTMLSpanElement>(null)

  const scaleLabels = useCallback(() => {
    const box = boxRef.current
    if (!box) return
    const boxWidth = box.offsetWidth
    for (const ref of [topLabelRef, bottomLabelRef]) {
      const el = ref.current
      if (!el) continue
      el.style.transform = ''
      const labelWidth = el.scrollWidth
      if (labelWidth > boxWidth) {
        el.style.transform = `scaleX(${boxWidth / labelWidth})`
      }
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: label/bottomLabel/compact are intentional extra deps — label scaling must re-measure whenever the rendered text or size changes
  useEffect(() => {
    scaleLabels()
  }, [label, bottomLabel, compact, scaleLabels])

  if (value === undefined) return null

  const boxSize = compact ? 'h-8 min-w-8 px-0.5' : 'h-12 w-12'
  // Disabled state: reduce overall opacity to signal disabled while preserving
  // foreground/background contrast. The default bg-su-white / text-su-black pair
  // has a 16:1 base ratio; at 60% opacity the effective ratio is ~9.6:1, still
  // well above the WCAG AA threshold of 4.5:1 for normal text.
  const disabledClass = disabled ? 'opacity-60' : ''

  const content = (
    // biome-ignore lint/a11y/useSemanticElements: a <fieldset> would break the flex stat-box layout; role="group" carries the same semantics
    <div
      role="group"
      className={cn(
        'flex flex-col items-center gap-0 overflow-visible',
        compact ? 'min-w-8' : 'w-12',
        disabledClass
      )}
      aria-label={combinedAriaLabel}
    >
      <Text
        ref={topLabelRef}
        variant="pseudoheader"
        as="span"
        className={cn(
          'z-[1] -mb-2 origin-center self-center whitespace-nowrap uppercase',
          compact ? 'text-[10px]' : 'text-xs'
        )}
        id={labelId}
      >
        {label}
      </Text>
      {onClick ? (
        <button
          ref={boxRef as React.Ref<HTMLButtonElement>}
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-disabled={disabled || undefined}
          className={cn(
            'flex items-center justify-center border',
            boxSize,
            trueBg,
            trueBorderColor,
            compact ? 'border' : 'border-[1.5px]',
            disabled
              ? 'pointer-events-none'
              : 'cursor-pointer hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-su-orange',
            isFlashing && 'animate-[growShrink_3s_ease-out] motion-reduce:animate-none'
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
          ref={boxRef}
          className={cn(
            'flex items-center justify-center border',
            boxSize,
            trueBg,
            trueBorderColor,
            compact ? 'border' : 'border-[1.5px]',
            isFlashing && 'animate-[growShrink_3s_ease-out] motion-reduce:animate-none'
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
        ref={bottomLabelRef}
        variant="pseudoheader"
        as="span"
        className={cn(
          'z-[1] -mt-2 origin-center self-center whitespace-nowrap uppercase',
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
