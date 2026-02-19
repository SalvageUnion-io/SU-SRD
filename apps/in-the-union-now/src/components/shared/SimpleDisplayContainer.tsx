import { useRef, useEffect, type ReactNode } from 'react'
import { Text } from 'suref-react'
import { cn } from '../../lib/utils'

type SimpleDisplayContainerProps = {
  children: ReactNode
  /** Optional label half-sunken into the top border (like StatDisplay labels) */
  label?: string
  compact?: boolean
  /** Background color class (default: bg-su-orange) */
  bg?: string
  className?: string
}

export function SimpleDisplayContainer({
  children,
  label,
  compact,
  bg = 'bg-su-orange',
  className,
}: SimpleDisplayContainerProps) {
  const labelRef = useRef<HTMLSpanElement>(null)

  const BASE_TRANSFORM = 'translateX(-50%) translateY(-50%)'

  useEffect(() => {
    const el = labelRef.current
    if (!el) return
    const parent = el.parentElement
    if (!parent) return
    // Reset to base so we measure natural width
    el.style.transform = BASE_TRANSFORM
    const parentW = parent.offsetWidth
    const labelW = el.scrollWidth
    if (labelW > parentW) {
      el.style.transform = `${BASE_TRANSFORM} scaleX(${parentW / labelW})`
    }
  })

  return (
    <div className={cn('relative flex items-center', className)}>
      {label && (
        <Text
          ref={labelRef}
          variant="pseudoheader"
          as="span"
          className={cn(
            'absolute left-1/2 top-0 z-[1] origin-top whitespace-nowrap uppercase',
            compact ? 'text-[10px]' : 'text-xs'
          )}
          style={{ transform: 'translateX(-50%) translateY(-50%)' }}
        >
          {label}
        </Text>
      )}
      <div
        className={cn(
          'flex items-center rounded-md border-2 border-su-black',
          bg,
          compact ? 'gap-1 px-2 py-1.5' : 'gap-2 px-3 py-2',
          label && (compact ? 'pt-2.5' : 'pt-3')
        )}
      >
        {children}
      </div>
    </div>
  )
}
