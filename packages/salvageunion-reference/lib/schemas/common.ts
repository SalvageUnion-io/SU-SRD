/**
 * Zod common primitive schemas from common.schema.json
 */

import { z } from 'zod'

/**
 * Unique identifier for the entry
 */
export const IdSchema = z.string()

/**
 * Name of the entry
 */
export const NameSchema = z.string().min(1)

/**
 * Non-negative integer (0 or greater)
 */
export const NonNegativeIntegerSchema = z.number().int().nonnegative()

/**
 * Positive integer (1 or greater)
 */
export const PositiveIntegerSchema = z.number().int().positive()

/**
 * URL to an image asset for this entry
 */
export const AssetUrlSchema = z.string().url()

/**
 * Cost in ability points to activate an ability
 */
export const ActivationCostSchema = z.union([z.number().int().nonnegative(), z.literal('X')])

/**
 * Technology level of the item or entity (number, 'B' for Bio, or 'N' for Nanite)
 */
export const TechLevelSchema = z.union([
  z.number().int().nonnegative(),
  z.literal('B'),
  z.literal('N'),
])
