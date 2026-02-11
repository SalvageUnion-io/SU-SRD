// Chakra UI component library (moved from suref-react)
// Framework-agnostic utilities (constants, types, lib) are still imported from 'suref-react'

// Theme
export { system, suColors, techLevelColors } from './theme'

// Recipes
export { headingRecipe } from './recipes/heading.recipe'
export { textRecipe } from './recipes/text.recipe'
export { buttonRecipe } from './recipes/button.recipe'

// Base typography
export { Heading } from './components/base/Heading'
export { Text } from './components/base/Text'

// UI primitives
export { Tooltip } from './components/ui/tooltip'
export type { TooltipProps } from './components/ui/tooltip'
export { toaster } from './components/ui/toaster'
export { Toaster } from './components/ui/ToasterComponent'

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
export { getSourceStyles } from './components/entity/entityDisplayHelpers'

// Entity display sub-components
export { PreselectedEntityDisplay } from './components/entity/EntityDisplay/PreselectedEntityDisplay'
export { EntityListDisplay } from './components/entity/EntityDisplay/EntityListDisplay'

// Shared components
export { Card } from './components/shared/Card'
export { ActivationCostBox } from './components/shared/ActivationCostBox'
export { ValueDisplay } from './components/shared/ValueDisplay'
export { RollTable } from './components/shared/RollTable'
export { SheetDisplay } from './components/shared/SheetDisplay'
export { LevelDisplay } from './components/shared/LevelDisplay'
export { SheetInput } from './components/shared/SheetInput'
export { EntityDisplayFooter } from './components/shared/EntityDisplayFooter'
export { default as Modal } from './components/Modal'
export { StatDisplay } from './components/StatDisplay'

// Skeletons
export { EntityCardSkeleton } from './components/skeleton/EntityCardSkeleton'
export { SchemaViewerSkeleton } from './components/skeleton/SchemaViewerSkeleton'

// Utilities
export { useParseTraitReferences } from './utils/parseTraitReferences'
