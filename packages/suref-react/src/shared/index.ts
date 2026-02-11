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
export type { DataValue, ItemCondition } from './types/common'

// Lib helpers
export {
  getParagraphString,
  replaceChassisPlaceholder,
  parseContentBlockString,
} from './lib/contentBlockHelpers'
export {
  extractEntityDetails,
  formatActionType,
  getActivationCurrency,
} from './lib/entityDataExtraction'
export { logger } from './lib/logger'

// Utilities
export { nameToSlug, findEntityBySlug, getEntitySlug } from './utils/slug'
export { getTiltRotation } from './utils/tiltUtils'
export { extractMatchSnippet, highlightMatch } from './utils/searchHighlight'
