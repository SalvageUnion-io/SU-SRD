import type { ReactNode } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { SheetDisplay } from '../../shared/SheetDisplay'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { borderColorFromHeaderBg } from '../referenceEntityHelpers'
import { cn } from '../../../utils/cn'
import type { getReferenceEntityFontSizes } from './referenceEntityDisplayTypes'
import { SectionSeparator } from './SectionSeparator'

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
  /** Entity data */
  data: SURefEntity
  /** Compact mode */
  compact: boolean
  /** Font sizes */
  fontSize: ReturnType<typeof getReferenceEntityFontSizes>
  /** Header background color */
  headerBg: string
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
  data,
  compact,
  fontSize,
  headerBg,
}: ConditionalSheetInfoProps) {
  let displayValue: string | undefined
  if (explicitValue !== undefined) {
    displayValue = explicitValue
  } else {
    const extractedValue = data[propertyName as keyof typeof data]
    displayValue = typeof extractedValue === 'string' ? extractedValue : undefined
  }

  const parsedContent = useParseTraitReferences(displayValue)

  if (!displayValue) return null
  if (!(propertyName in data) && explicitValue === undefined) return null

  // Special handling for damagedEffect - render with content block styling
  if (propertyName === 'damagedEffect') {
    return (
      <div>
        {label && <SectionSeparator label={label} fontSize="text-sm" compact={compact} />}
        <div
          className={cn(
            'mb-2 break-words font-medium leading-snug whitespace-normal text-su-black',
            compact ? 'pl-2' : 'pl-3',
            fontSize.sm
          )}
          style={{
            overflowWrap: 'break-word',
            borderLeft: `3px solid ${borderColorFromHeaderBg(headerBg)}`,
          }}
        >
          {children || parsedContent}
        </div>
      </div>
    )
  }

  return (
    <div className="flex">
      <SheetDisplay compact={compact} label={label} labelColor={labelBgColor}>
        {children || parsedContent}
      </SheetDisplay>
    </div>
  )
}
