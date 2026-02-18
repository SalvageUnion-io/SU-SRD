import { memo } from 'react'
import type { ReactNode } from 'react'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { EntityDisplayContent } from './components/EntityDisplayContent'
import type {
  ClassAbilitiesRenderer,
  EntityHideConfig,
  NpcConfig,
  PatternOverrideData,
} from './entityDisplayTypes'
import type { GuideStepsInteractiveConfig } from '../GuideStepsDisplay'
import type { EntityControl } from './entityControlTypes'

type EntityDisplayProps = {
  /** Entity data to display - only accepts SURefEntity (not SURefMetaAction or SURefObjectSystemModule) */
  data: SURefEntity | undefined
  /** Optional header background color override */
  headerColor?: string
  /** Whether the ability is trained (affects header opacity for abilities) */
  dimHeader?: boolean
  /** Optional children to render in the content area */
  children?: ReactNode
  /** Whether the entity is disabled (affects opacity and click behavior) */
  disabled?: boolean
  /** Whether to show only the header (click opens a detail modal) */
  listing?: boolean
  /** Whether the entity is damaged (affects header color and styling) */
  damaged?: boolean
  /** Whether to use compact styling */
  compact?: boolean
  /** Visibility toggles — which sections to hide */
  hide?: EntityHideConfig
  /** Optional label rendered above the card (absolute-positioned pseudoheader) */
  label?: string
  /** Optional renderer for class abilities section */
  classAbilitiesRenderer?: ClassAbilitiesRenderer
  /** Optional pattern override — when set, display uses this pattern name as title and renders its systems/modules */
  patternOverride?: PatternOverrideData
  /** Controls to render in the header (add, delete, detail, etc.) */
  controls?: EntityControl[]
  /** Interactive config for guide entities — threads through to GuideStepsDisplay */
  interactive?: GuideStepsInteractiveConfig
  /** Grouped NPC configuration (children, hp slot, name editing, etc.) */
  npcConfig?: NpcConfig
  /** Content to render in a right column alongside the NPC section (creates a 2-column grid) */
  rightContent?: ReactNode
  /** When set, renders a semi-translucent overlay over the body with this text in a danger box */
  damageOverlayText?: string
  /** When true, header renders only title and controls — no subtitle, stats, or tech level */
  lightweight?: boolean
}

export const EntityDisplay = memo(function EntityDisplay({
  damaged = false,
  data,
  headerColor,
  dimHeader = false,
  children,
  disabled = false,
  listing = false,
  hide,
  compact = false,
  label,
  classAbilitiesRenderer,
  patternOverride,
  controls,
  interactive,
  npcConfig,
  rightContent,
  damageOverlayText,
  lightweight = false,
}: EntityDisplayProps) {
  if (!data) return null

  // Get schemaName from data, with fallback for entities that might not have it yet
  const schemaName = (
    'schemaName' in data && typeof data.schemaName === 'string' ? data.schemaName : undefined
  ) as SURefEnumSchemaName | undefined

  if (!schemaName) {
    console.warn('EntityDisplay: data does not have schemaName property', data)
    return null
  }

  return (
    <EntityDisplayContent
      data={data}
      schemaName={schemaName}
      compact={compact}
      headerColor={headerColor}
      dimHeader={dimHeader}
      disabled={disabled}
      hide={hide}
      listing={listing}
      damaged={damaged}
      label={label}
      classAbilitiesRenderer={classAbilitiesRenderer}
      patternOverride={patternOverride}
      controls={controls}
      interactive={interactive}
      npcConfig={npcConfig}
      rightContent={rightContent}
      damageOverlayText={damageOverlayText}
      lightweight={lightweight}
    >
      {children}
    </EntityDisplayContent>
  )
})
