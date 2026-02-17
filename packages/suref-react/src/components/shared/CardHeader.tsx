import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { Text } from '../base/Text'
import { ControlButtons } from './ControlButtons'
import type { EntityControl } from '../entity/EntityDisplay/entityControlTypes'

type CardHeaderProps = {
  title: string | ReactNode
  subtitle?: ReactNode
  controls?: EntityControl[]
  controlSize?: 'sm' | 'default'
  leftContent?: ReactNode
  rightContent?: ReactNode
  compact?: boolean
  disabled?: boolean
}

export function CardHeader({
  title,
  subtitle,
  controls,
  controlSize,
  leftContent,
  rightContent,
  compact = false,
  disabled = false,
}: CardHeaderProps) {
  const titleElement =
    typeof title === 'string' ? (
      <Text
        variant="pseudoheader"
        as="span"
        className={cn(
          'uppercase tracking-[-0.02em]',
          compact ? 'py-[3px] text-base' : 'text-[1.75rem]',
          disabled && 'opacity-50'
        )}
        style={compact ? { lineHeight: 1 } : undefined}
      >
        {title}
      </Text>
    ) : (
      title
    )

  const hasRightSide = !!rightContent || (controls && controls.length > 0)

  return (
    <>
      <div className={cn('flex min-w-0 items-center', compact ? 'gap-0.5' : 'gap-1')}>
        {leftContent}
        <div
          className={cn(
            'flex min-w-0 flex-col justify-center overflow-visible',
            compact ? 'gap-0.5' : 'gap-1'
          )}
        >
          {titleElement}
          {subtitle}
        </div>
      </div>
      {hasRightSide && (
        <div className="flex gap-1">
          {rightContent}
          {controls && controls.length > 0 && (
            <ControlButtons controls={controls} size={controlSize} />
          )}
        </div>
      )}
    </>
  )
}
