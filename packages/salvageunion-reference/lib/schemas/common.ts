/**
 * Zod common primitive schemas from common.schema.json
 */

import { z } from 'zod'

/**
 * Unique identifier for the entry
 */
export const IdSchema = z.string().describe('Unique identifier for the entry')

/**
 * Name of the entry
 */
export const NameSchema = z.string().min(1).describe('Name of the entry')

/**
 * Non-negative integer (0 or greater)
 */
export const NonNegativeIntegerSchema = z
  .number()
  .int()
  .nonnegative()
  .describe('Non-negative integer (0 or greater)')

/**
 * Positive integer (1 or greater)
 */
export const PositiveIntegerSchema = z
  .number()
  .int()
  .positive()
  .describe('Positive integer (1 or greater)')

/**
 * URL to an image asset for this entry
 */
export const AssetUrlSchema = z.string().url().describe('URL to an image asset for this entry')

/**
 * Cost in ability points to activate an ability
 */
export const ActivationCostSchema = z
  .union([z.number().int().nonnegative(), z.literal('X')])
  .describe('Cost in ability points to activate an ability')

/**
 * Technology level of the item or entity (number, 'B' for Bio, or 'N' for Nanite)
 */
export const TechLevelSchema = z
  .union([z.number().int().nonnegative(), z.literal('B'), z.literal('N')])
  .describe("Technology level of the item or entity (number, 'B' for Bio, or 'N' for Nanite)")
