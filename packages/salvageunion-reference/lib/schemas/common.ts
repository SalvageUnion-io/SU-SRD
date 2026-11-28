/**
 * Zod common primitive schemas from common.schema.json
 */

import { z } from '../zod'

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
 * Cost in ability points to activate an ability
 */
export const ActivationCostSchema = z
  .union([z.number().int().nonnegative(), z.literal('X')])
  .describe('Cost in ability points to activate an ability')

/**
 * Technology level of the item or entity (integer 1-6, 'B' for Bio, 'N' for
 * Nanite, or 'C' for Crawler).
 *
 * 'C' is the class-granted gear's: the book prints no Tech Level on gear a
 * class ability gives you ("only you can use"), and where it gives one it is
 * "a Tech Level equal to your Union Crawler" (Core Book pp. 30, 48, 55, 68).
 */
export const TechLevelSchema = z
  .union([z.number().int().min(1).max(6), z.literal('B'), z.literal('N'), z.literal('C')])
  .describe(
    "Technology level of the item or entity (integer 1-6, 'B' for Bio, 'N' for Nanite, or 'C' for Crawler: equal to your Union Crawler's, the class-granted gear's)"
  )
