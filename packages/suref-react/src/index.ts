// Constants
export {
  TECH_LEVELS,
  MAX_TECH_LEVEL,
  getMaxTechLevel,
  DEBOUNCE_TIMINGS,
  SCRAP_CONVERSION_RATES,
  UPKEEP_STEP,
  MAX_UPGRADE,
} from './constants/gameRules'
export type { TechLevel } from './constants/gameRules'

// Types
export type { DataValue, ItemCondition } from './types/common'
export type {
  ClassAbilitiesRenderer,
  EntityImageComponent,
  EntityImageComponentProps,
} from './components/entity/EntityDisplay/entityDisplayContext'

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
export { EntityDisplayModal } from './components/entity/EntityDisplayModal'
export { EntityDisplayTooltip } from './components/entity/EntityDisplayTooltip'
export { EntitySelectionModal } from './components/entity/EntitySelectionModal'

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

// Utilities
export { getEntitySlug } from './utils/slug'
export { cn } from './utils/cn'
