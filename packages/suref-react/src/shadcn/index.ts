// Re-export everything from shared
export * from '../shared/index'

// Base typography
export { Heading } from './components/base/Heading'
export { Text } from './components/base/Text'

// UI primitives
export { Tooltip } from './components/ui/tooltip'
export { toast, Toaster } from './components/ui/toaster'
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './components/ui/dialog'

// Entity display system
export { EntityDisplay } from './components/entity/EntityDisplay/index'
export { EntityDisplayProvider } from './components/entity/EntityDisplay/EntityDisplayProvider'
export {
  EntityDisplayContext,
  getEntitySpacing,
  getEntityFontSizes,
} from './components/entity/EntityDisplay/entityDisplayContext'
export type {
  EntityDisplayContextValue,
  ClassAbilitiesRenderer,
  EntityButtonConfig,
} from './components/entity/EntityDisplay/entityDisplayContext'
export { useEntityDisplayContext } from './components/entity/EntityDisplay/useEntityDisplayContext'
export { EntityDisplayContent } from './components/entity/EntityDisplay/components/EntityDisplayContent'
export { EntityDisplayModal } from './components/entity/EntityDisplayModal'
export { EntityDisplayTooltip } from './components/entity/EntityDisplayTooltip'
export { EntitySelectionModal } from './components/entity/EntitySelectionModal'
export { DataValueDisplayView } from './components/entity/DataValueDisplayView'
export { TraitKeywordDisplayView } from './components/entity/TraitKeywordDisplayView'
export { BlockContentRendererView } from './components/entity/BlockContentRendererView'
export { InlineContentBlock } from './components/entity/InlineContentBlock'
export { NestedActionDisplay } from './components/entity/NestedActionDisplay'
export { NestedChassisAbility } from './components/entity/NestedChassisAbility'
export { NotFoundDisplay } from './components/entity/NotFoundDisplay'
export { EntityDetailDisplay } from './components/entity/EntityDetailDisplay'

// Entity display helpers (shadcn-specific: returns Tailwind classes)
export {
  extractName,
  calculateBackgroundColor,
  calculateOpacity,
  createHeaderClickHandler,
  shouldShowExtraContent,
  getEntityDisplayName,
  resolveEntityName,
  getSourceStyles,
} from './components/entity/entityDisplayHelpers'

// Entity display sub-components (for direct import when needed)
export { PreselectedEntityDisplay } from './components/entity/EntityDisplay/PreselectedEntityDisplay'
export { EntityListDisplay } from './components/entity/EntityDisplay/EntityListDisplay'

// Shared components
export { Card } from './components/shared/Card'
export { ValueDisplay } from './components/shared/ValueDisplay'
export { StatDisplay } from './components/shared/StatDisplay'
export { ActivationCostBox } from './components/shared/ActivationCostBox'
export { LevelDisplay } from './components/shared/LevelDisplay'
export { SheetDisplay } from './components/shared/SheetDisplay'
export { SheetInput } from './components/shared/SheetInput'
export { EntityDisplayFooter } from './components/shared/EntityDisplayFooter'
export { RollTable } from './components/shared/RollTable'
export { ResourceStepper } from './components/shared/ResourceStepper'
export { ResourceBar } from './components/shared/ResourceBar'
export { HeatBar } from './components/shared/HeatBar'
export { InlineEdit } from './components/shared/InlineEdit'
export { RollResult } from './components/shared/RollResult'
export { ConditionControl } from './components/shared/ConditionControl'
export { ActionFilterChips } from './components/shared/ActionFilterChips'

// Skeletons
export { EntityCardSkeleton } from './components/skeleton/EntityCardSkeleton'
export { SchemaViewerSkeleton } from './components/skeleton/SchemaViewerSkeleton'

// ShadCN-specific utilities
export { cn } from './utils/cn'
export { useParseTraitReferences } from './utils/parseTraitReferences'
