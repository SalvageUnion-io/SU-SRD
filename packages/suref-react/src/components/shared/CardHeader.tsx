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
          'uppercase tracking-[0.01em]',
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

  // Unified header for compact AND non-compact:
  //  - Left: the TL/level box vertically centred to the left of the title +
  //    data-row stack (which carries the title and the data/subtitle row).
  //  - Right: proper right content (flavor / chassis stats) as its own column
  //    that splits the whole header.
  // The left (title + data) gets flex preference; the right is capped at 60%
  // so it can stretch into the left when the left is short, and shrinks back
  // when the left needs the room.
  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-2">
      <div
        className={cn(
          'flex min-w-0 items-center',
          // With a right-side flavor: claim only the content and cap the width so
          // a wide data row can't crush the flavor. With no flavor (e.g.
          // systems/modules — their only right element is the separate stats
          // column), let the left stretch to fill the header so the data row uses
          // the full width instead of wrapping beside a big empty gap.
          hasRightSide ? 'flex-[0_1_auto]' : 'flex-1',
          // Cap the left so a flavored ability's data row can't crush the flavor.
          // The cap is what the left *reserves*, not what it *uses* — when the
          // data row wraps short of the cap, the freed width goes to the flavor.
          // 50/60 (was 60/70) keeps the data row's left-preference but hands the
          // flavor a fairer share when the row doesn't fill its ceiling.
          hasRightSide && (compact ? 'max-w-[60%]' : 'max-w-[50%]'),
          compact ? 'gap-0.5' : 'gap-1'
        )}
      >
        {!lightweight && leftContent}
        {/* flex-1 so the title/data column fills the (stretched) left block —
            otherwise it stays content-sized and the data row wraps narrow. */}
        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col overflow-visible',
            compact ? 'gap-0.5' : 'gap-1'
          )}
        >
          {titleElement}
          {!lightweight && subtitle}
        </div>
      </div>
      {hasRightSide && (
        <div
          // flex-1 == flex: 1 1 0% — a ZERO basis is the key: the right column
          // doesn't claim its content width up front (which would push/compete
          // with the left). The left (flex-[0_1_auto]) claims its content first;
          // the right then grows into whatever space is left over — stretching
          // into empty space when the left is short, yielding when it isn't.
          className="flex min-w-0 flex-1 items-start justify-end gap-1"
        >
          {!lightweight && rightContent}
          {hasControls && <ControlButtons controls={controls} compact={compact} />}
        </div>
      )}
    </div>
  )
}
