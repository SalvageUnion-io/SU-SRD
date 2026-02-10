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
export { getActivationCurrency, getSourceStyles } from './components/entity/entityDisplayHelpers'

// Entity display sub-components (for direct import when needed)
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
export { nameToSlug, findEntityBySlug, getEntitySlug } from './utils/slug'
export { useParseTraitReferences } from './utils/parseTraitReferences'
export { getTiltRotation } from './utils/tiltUtils'
export { extractMatchSnippet, highlightMatch } from './utils/searchHighlight'

// Lib helpers
export {
  getParagraphString,
  replaceChassisPlaceholder,
  parseContentBlockString,
} from './lib/contentBlockHelpers'
export { extractEntityDetails, formatActionType } from './lib/entityDataExtraction'
export { logger } from './lib/logger'

// Constants
export {
  TECH_LEVELS,
  MIN_TECH_LEVEL,
  MAX_TECH_LEVEL,
  getMaxTechLevel,
  CARGO_GRID_CONFIGS,
  getCargoGridConfig,
  PILOT_DEFAULTS,
  CRAWLER_DEFAULTS,
  MECH_DEFAULTS,
  DEBOUNCE_TIMINGS,
  MODAL_SIZES,
  ACTIVATION_CURRENCIES,
  SCRAP_CONVERSION_RATES,
  LEGENDARY_ABILITY_COST,
  ADVANCED_ABILITY_COST,
  CORE_ABILITY_COST,
  DEFAULT_ABILITY_COST,
  UPKEEP_STEP,
  MAX_UPGRADE,
} from './constants/gameRules'
export type { TechLevel } from './constants/gameRules'

// Types
export type { DataValue } from './types/common'
