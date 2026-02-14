import { memo } from 'react'
import type { ReactNode } from 'react'
import type {
  SURefEntity,
  SURefEnumSchemaName,
  SURefObjectPatternSystemModule,
} from 'salvageunion-reference'
import { EntityDisplayContent } from './components/EntityDisplayContent'
import type {
  ClassAbilitiesRenderer,
  EntityButtonConfig,
  EntityImageComponent,
} from './entityDisplayTypes'

type EntityDisplayProps = {
  /** Entity data to display - only accepts SURefEntity (not SURefMetaAction or SURefObjectSystemModule) */
  data: SURefEntity | undefined
  /** Optional header background color override */
  headerColor?: string
  /** Whether the ability is trained (affects header opacity for abilities) */
  dimHeader?: boolean
  /** Optional children to render in the content area */
  children?: ReactNode
  /** Optional click handler for the entity */
  onClick?: () => void
  /** Whether the entity is disabled (affects opacity and click behavior) */
  disabled?: boolean
  /** Whether the entity can be collapsed/expanded */
  collapsible?: boolean
  /** Optional button configuration - if provided, renders a button at the bottom of the entity */
  buttonConfig?: EntityButtonConfig
  /** Optional custom content displayed in the top-right corner */
  rightContent?: ReactNode
  /** Whether the entity is damaged (affects header color and tilts components) */
  damaged?: boolean
  /** Whether to use compact styling */
  compact?: boolean
  /** Whether to hide the level display */
  hideLevel?: boolean
  /** Whether to hide the actions section */
  hideActions?: boolean
  /** Whether to hide chassis patterns */
  hidePatterns?: boolean
  /** Whether to hide choices */
  hideChoices?: boolean
  /** User choices object matching the format sent to the API: Record<choiceId, "schemaName||entityId"> */
  userChoices?: Record<string, string> | null
  /** Custom width for the image (e.g., '40%') */
  imageWidth?: string
  /** Optional label rendered above the card (absolute-positioned pseudoheader) */
  label?: string
  /** Optional renderer for class abilities section */
  classAbilitiesRenderer?: ClassAbilitiesRenderer
  /** Optional custom image component (defaults to native img) */
  imageComponent?: EntityImageComponent
  /** Optional pattern override — when set, display uses this pattern name as title and renders its systems/modules */
  patternOverride?: {
    name: string
    systems: SURefObjectPatternSystemModule[]
    modules: SURefObjectPatternSystemModule[]
  }
  /** Whether to hide the stats/right content in the header */
  hideStats?: boolean
}

export const EntityDisplay = memo(function EntityDisplay({
  rightContent,
  damaged = false,
  data,
  hideLevel = false,
  headerColor,
  dimHeader = false,
  children,
  onClick,
  disabled = false,
  collapsible = false,
  buttonConfig,
  hideActions = false,
  hidePatterns = false,
  hideChoices = false,
  compact = false,
  userChoices,
  imageWidth,
  label,
  classAbilitiesRenderer,
  imageComponent,
  patternOverride,
  hideStats = false,
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
      hideActions={hideActions}
      hidePatterns={hidePatterns}
      hideChoices={hideChoices}
      collapsible={collapsible}
      onClick={onClick}
      hideLevel={hideLevel}
      rightContent={rightContent}
      damaged={damaged}
      buttonConfig={buttonConfig}
      userChoices={userChoices}
      imageWidth={imageWidth}
      label={label}
      classAbilitiesRenderer={classAbilitiesRenderer}
      imageComponent={imageComponent}
      patternOverride={patternOverride}
      hideStats={hideStats}
    >
      {children}
    </EntityDisplayContent>
  )
})
