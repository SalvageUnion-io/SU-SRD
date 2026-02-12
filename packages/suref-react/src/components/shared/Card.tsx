import { useCallback } from 'react'
import type { ReactNode } from 'react'
import type { SURefEnumSource } from 'salvageunion-reference'
import { cn } from '../../utils/cn'
import { Text } from '../base/Text'
import { getSourceStyles } from '../entity/entityDisplayHelpers'

type CardProps = {
  bg?: string
  headerBg?: string
  headerOpacity?: number
  title?: string
  leftContent?: ReactNode
  rightContent?: ReactNode
  subTitleContent?: ReactNode
  children?: ReactNode
  titleRotation?: number
  disabled?: boolean
  bodyBg?: string
  bodyPadding?: string
  onHeaderClick?: () => void
  headerTestId?: string
  absoluteElements?: ReactNode
  label?: string
  compact?: boolean
  reverse?: boolean
  source?: SURefEnumSource
  isExpanded?: boolean
  className?: string
}

export function Card({
  label,
  compact = false,
  bg = 'bg-su-blue-light',
  headerBg,
  headerOpacity = 1,
  title,
  leftContent,
  rightContent,
  subTitleContent,
  children,
  absoluteElements,
  titleRotation = 0,
  disabled = false,
  bodyBg,
  bodyPadding,
  onHeaderClick,
  headerTestId,
  reverse = false,
  source,
  isExpanded = true,
  className,
}: CardProps) {
  const actualHeaderBg = disabled ? 'bg-su-grey' : headerBg || bg
  const actualBodyBg = disabled ? 'bg-su-grey' : bodyBg || bg
  const hasHeader = !!(title || leftContent || rightContent)

  const sourceStyles = getSourceStyles(source, disabled, 'header', isExpanded)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (onHeaderClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        onHeaderClick()
      }
    },
    [onHeaderClick]
  )

  return (
    <div
      className={cn(
        'relative flex shrink-0 flex-col items-center justify-between overflow-visible rounded-md shadow-lg',
        actualBodyBg,
        className
      )}
    >
      {absoluteElements}
      {label && (
        <Text
          variant="pseudoheader"
          as="span"
          className={cn(
            'absolute ml-3 uppercase',
            compact
              ? '-mt-1.5 text-xs max-w-[80%] scale-x-[0.85] origin-left whitespace-nowrap'
              : '-mt-2 text-sm'
          )}
        >
          {label}
        </Text>
      )}
      {hasHeader && (
        <div
          role={onHeaderClick ? 'button' : undefined}
          tabIndex={onHeaderClick ? 0 : undefined}
          className={cn(
            'flex w-full items-center justify-between gap-2 overflow-visible rounded-t-sm',
            reverse ? 'flex-row-reverse' : 'flex-row',
            actualHeaderBg,
            compact ? 'min-h-[60px] px-1 py-1' : 'min-h-[80px] px-1.5 py-1.5',
            label && (compact ? 'pt-3 pb-3' : 'pt-4 pb-4'),
            !children && 'rounded-b-sm',
            onHeaderClick && 'cursor-pointer',
            sourceStyles.className
          )}
          style={{ opacity: headerOpacity, ...sourceStyles.style }}
          onClick={onHeaderClick}
          onKeyDown={onHeaderClick ? handleKeyDown : undefined}
          data-testid={headerTestId}
        >
          <div className={cn('flex items-center', compact ? 'gap-0.5' : 'gap-1')}>
            {leftContent}
            <div
              className={cn(
                'flex flex-col justify-center overflow-visible',
                compact ? 'gap-0.5' : 'gap-1',
                reverse ? 'items-end' : 'items-start'
              )}
            >
              {title && (
                <div
                  className={cn(
                    compact ? '' : 'overflow-hidden text-ellipsis whitespace-nowrap',
                    reverse && 'text-right'
                  )}
                  style={
                    titleRotation !== 0 ? { transform: `rotate(${titleRotation}deg)` } : undefined
                  }
                >
                  <Text
                    variant="pseudoheader"
                    as="span"
                    className={cn(
                      'relative z-10 uppercase tracking-[-0.02em] transition-transform duration-300',
                      compact ? 'text-base py-[3px]' : 'text-[1.75rem]',
                      disabled && 'opacity-50'
                    )}
                    style={compact ? { lineHeight: 1 } : undefined}
                  >
                    {title}
                  </Text>
                </div>
              )}
              {subTitleContent && (
                <div
                  className={cn(
                    'z-10 flex flex-wrap items-center overflow-visible',
                    reverse ? 'justify-end' : 'justify-start',
                    compact ? 'gap-1' : 'gap-2'
                  )}
                >
                  {subTitleContent}
                </div>
              )}
            </div>
          </div>
          {rightContent}
        </div>
      )}
      {children && (
        <div
          className={cn(
            'flex w-full flex-1 flex-col items-center rounded-b-md',
            bodyPadding || 'p-3'
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}
