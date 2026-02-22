import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { Text } from '../base/Text'
import { ControlButtons } from './ControlButtons'
import type { ReferenceEntityControl } from '../referenceEntity/ReferenceEntityDisplay/referenceEntityControlTypes'

type CardHeaderProps = {
  title: string | ReactNode
  subtitle?: ReactNode
  controls?: ReferenceEntityControl[]
  leftContent?: ReactNode
  rightContent?: ReactNode
  compact?: boolean
  disabled?: boolean
  /** When true, renders only title and controls — no subtitle, leftContent, or rightContent */
  lightweight?: boolean
  /** HTML element to use for the title text (default: 'span') */
  titleAs?: 'span' | 'h1'
}

export function CardHeader({
  title,
  subtitle,
  controls,
  leftContent,
  rightContent,
  compact = false,
  disabled = false,
  lightweight = false,
  titleAs = 'span',
}: CardHeaderProps) {
  const titleElement =
    typeof title === 'string' ? (
      <Text
        variant="pseudoheader"
        as={titleAs}
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

  // Compact + right side: single nowrap flex container so left/right never line-break.
  // flex ratios: left shrinks 1.5× faster, right grows 1.2× more → mild right-side preference.
  if (compact && hasRightSide) {
    return (
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-1 lg:flex-nowrap">
        <div className="flex min-w-0 max-w-[70%] flex-[2_1_auto] items-center gap-0.5 md:max-w-[70%]">
          {!lightweight && leftContent}
          <div className="flex min-w-0 flex-col justify-center gap-0.5 overflow-visible">
            {titleElement}
            {!lightweight && subtitle}
          </div>
        </div>
        <div className="flex min-w-0 basis-full items-center justify-end gap-1 md:basis-auto md:max-w-[60%] md:flex-[1_2_auto]">
          {!lightweight && rightContent}
          {hasControls && <ControlButtons controls={controls} compact={compact} />}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={cn('flex min-w-0 flex-1 items-center', compact ? 'gap-0.5' : 'gap-1')}>
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
          {hasControls && <ControlButtons controls={controls} compact={compact} />}
        </div>
      )}
    </>
  )
}
