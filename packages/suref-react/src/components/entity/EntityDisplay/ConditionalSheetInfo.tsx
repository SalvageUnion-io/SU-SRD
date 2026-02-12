import type { ReactNode } from 'react'
import { SheetDisplay } from '../../shared/SheetDisplay'
import { useEntityDisplayContext } from './useEntityDisplayContext'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { useMemo } from 'react'
import { getTiltRotation } from '../../../utils/tiltUtils'
import { Text } from '../../base/Text'
import { cn } from '../../../utils/cn'

type ConditionalSheetInfoProps = {
  /** Property name to check in data (for backwards compatibility) */
  propertyName: string
  /** Optional explicit value to display (takes precedence over propertyName) */
  value?: string
  /** Optional label */
  label?: string
  /** Optional label color */
  labelBgColor?: string
  /** Optional children to render */
  children?: ReactNode
}

/**
 * Wrapper component for conditional SheetDisplay rendering.
 * Can either extract value from entity data via propertyName, or use explicit value prop.
 */
export function ConditionalSheetInfo({
  propertyName,
  value: explicitValue,
  label,
  labelBgColor,
  children,
}: ConditionalSheetInfoProps) {
  const { data, spacing, compact, damaged, fontSize, headerBg } = useEntityDisplayContext()

  let displayValue: string | undefined
  if (explicitValue !== undefined) {
    displayValue = explicitValue
  } else {
    const extractedValue = data[propertyName as keyof typeof data]
    displayValue = typeof extractedValue === 'string' ? extractedValue : undefined
  }

  const parsedContent = useParseTraitReferences(displayValue)
  const valueRotation = useMemo(() => (damaged ? getTiltRotation() : 0), [damaged])

  if (!displayValue) return null
  if (!(propertyName in data) && explicitValue === undefined) return null

  // Special handling for damagedEffect - render with content block styling
  if (propertyName === 'damagedEffect') {
    return (
      <div
        style={{
          paddingLeft: `${spacing.contentPaddingX}rem`,
          paddingRight: `${spacing.contentPaddingX}rem`,
          paddingTop: `${spacing.contentPadding}rem`,
          paddingBottom: `${spacing.contentPadding}rem`,
        }}
      >
        <div
          className="transition-transform duration-300"
          style={damaged ? { transform: `rotate(${valueRotation}deg)` } : undefined}
        >
          {label && (
            <Text
              as="span"
              className={cn('block font-bold leading-relaxed text-su-black', fontSize.lg)}
            >
              {label}
            </Text>
          )}
          <div
            className={cn(
              'mb-2 break-words font-medium leading-relaxed whitespace-normal text-su-black',
              compact ? 'pl-2' : 'pl-3',
              fontSize.sm
            )}
            style={{
              overflowWrap: 'break-word',
              borderLeft: `3px solid var(--color-${headerBg.replace('bg-', '')})`,
            }}
          >
            {children || parsedContent}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex"
      style={{
        paddingLeft: `${spacing.contentPaddingX}rem`,
        paddingRight: `${spacing.contentPaddingX}rem`,
        paddingTop: `${spacing.contentPadding}rem`,
        paddingBottom: `${spacing.contentPadding}rem`,
      }}
    >
      <div
        className="transition-transform duration-300"
        style={damaged ? { transform: `rotate(${valueRotation}deg)` } : undefined}
      >
        <SheetDisplay compact={compact} label={label} labelColor={labelBgColor}>
          {children || parsedContent}
        </SheetDisplay>
      </div>
    </div>
  )
}
