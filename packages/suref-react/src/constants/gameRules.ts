/**
 * Game Rules Constants
 *
 * Centralized constants for Salvage Union game rules and mechanics.
 * These values should be used throughout the application instead of hardcoded magic numbers.
 *
 * Note: Tech level constants and game rule defaults are imported from salvageunion-reference package
 * to ensure a single source of truth.
 */

import { getTechLevels, getMaxTechLevel, getScrapConversionRates } from 'salvageunion-reference'

/**
 * Tech Level Constants
 * Derived from crawler-tech-levels data in the package
 */
export const TECH_LEVELS = getTechLevels() as readonly [1, 2, 3, 4, 5, 6]
export { getMaxTechLevel }

export const MAX_TECH_LEVEL = getMaxTechLevel()

export type TechLevel = (typeof TECH_LEVELS)[number]

/**
 * Debounce Timings (in milliseconds)
 */
export const DEBOUNCE_TIMINGS = {
  /** Auto-save delay for live sheet updates */
  autoSave: 300,
  /** Search input delay */
  search: 300,
  /** Filter input delay */
  filter: 300,
} as const

/**
 * Scrap Conversion Rates
 * Each tech level is worth this many TL1 scrap
 * Derived from package data
 */
export const SCRAP_CONVERSION_RATES: Record<TechLevel, number> =
  getScrapConversionRates() as Record<TechLevel, number>

export const UPKEEP_STEP = 5

export const MAX_UPGRADE = 25
