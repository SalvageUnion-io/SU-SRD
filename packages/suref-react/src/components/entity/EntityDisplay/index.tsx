import { memo } from 'react'
import type { ReactNode } from 'react'
import type {
  SURefEntity,
  SURefEnumSchemaName,
  SURefObjectPatternSystemModule,
} from 'salvageunion-reference'
import { EntityDisplayContent } from './components/EntityDisplayContent'
import type { ClassAbilitiesRenderer } from './entityDisplayTypes'

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
  /** Whether the entity is damaged (affects header color and tilts components) */
  damaged?: boolean
  /** Whether to use compact styling */
  compact?: boolean
  /** Whether to hide the actions section */
  hideActions?: boolean
  /** Whether to hide chassis patterns */
  hidePatterns?: boolean
  /** Whether to hide choices */
  hideChoices?: boolean
  /** Optional label rendered above the card (absolute-positioned pseudoheader) */
  label?: string
  /** Optional renderer for class abilities section */
  classAbilitiesRenderer?: ClassAbilitiesRenderer
  /** Optional pattern override — when set, display uses this pattern name as title and renders its systems/modules */
  patternOverride?: {
    name: string
    systems: SURefObjectPatternSystemModule[]
    modules: SURefObjectPatternSystemModule[]
  }
  /** Whether to hide the stats/right content in the header */
  hideStats?: boolean
  /** Whether to hide the entity's own content blocks (description) */
  hideContent?: boolean
  /** Optional delete handler — when set, renders a trash icon in the listing header */
  onDelete?: () => void
  /** Optional add handler — when set, renders a + icon in the header */
  onAdd?: () => void
  /** Optional edit handler — when set, renders an edit button next to the detail button in listing mode */
  onEdit?: () => void
  /** Optional open handler — when set, overrides the default listing click behavior (opening modal) */
  onOpen?: () => void
}

export const EntityDisplay = memo(function EntityDisplay({
  damaged = false,
  data,
  headerColor,
  dimHeader = false,
  children,
  disabled = false,
  listing = false,
  hideActions = false,
  hidePatterns = false,
  hideChoices = false,
  compact = false,
  label,
  classAbilitiesRenderer,
  patternOverride,
  hideStats = false,
  hideContent = false,
  onDelete,
  onAdd,
  onEdit,
  onOpen,
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
      listing={listing}
      damaged={damaged}
      label={label}
      classAbilitiesRenderer={classAbilitiesRenderer}
      patternOverride={patternOverride}
      hideStats={hideStats}
      hideContent={hideContent}
      onDelete={onDelete}
      onAdd={onAdd}
      onEdit={onEdit}
      onOpen={onOpen}
    >
      {children}
    </EntityDisplayContent>
  )
})
