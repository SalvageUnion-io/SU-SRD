import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { Text } from '../base/Text'
import { ControlButtons } from './ControlButtons'
import type { ReferenceEntityControl } from '../referenceEntity/ReferenceEntityDisplay/referenceEntityControlTypes'

type CardHeaderProps = {
  title: string | ReactNode
  subtitle?: ReactNode
  controls?: ReferenceEntityControl[]
  controlSize?: 'sm' | 'default'
  leftContent?: ReactNode
  rightContent?: ReactNode
  compact?: boolean
  disabled?: boolean
  /** When true, renders only title and controls — no subtitle, leftContent, or rightContent */
  lightweight?: boolean
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
  lightweight = false,
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

  const hasControls = controls && controls.length > 0
  const hasRightSide = lightweight ? hasControls : !!rightContent || hasControls

  return (
    <>
      <div className={cn('flex min-w-0 items-center', compact ? 'gap-0.5' : 'gap-1')}>
        {!lightweight && leftContent}
        <div
          className={cn(
            'flex min-w-0 flex-col justify-center overflow-visible',
            compact ? 'gap-0.5' : 'gap-1'
          )}
        >
          {titleElement}
          {!lightweight && subtitle}
        </div>
      </div>
      {hasRightSide && (
        <div className="flex gap-1">
          {!lightweight && rightContent}
          {hasControls && <ControlButtons controls={controls} size={controlSize} />}
        </div>
      )}
    </>
  )
}
