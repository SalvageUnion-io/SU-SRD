/**
 * Zod common primitive schemas from common.schema.json
 */
import { z } from '../zod';
/**
 * Unique identifier for the entry
 */
export declare const IdSchema: z.ZodString;
/**
 * Name of the entry
 */
export declare const NameSchema: z.ZodString;
/**
 * Non-negative integer (0 or greater)
 */
export declare const NonNegativeIntegerSchema: z.ZodNumber;
/**
 * Positive integer (1 or greater)
 */
export declare const PositiveIntegerSchema: z.ZodNumber;
/**
 * Cost in ability points to activate an ability
 */
export declare const ActivationCostSchema: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"X">]>;
/**
 * Technology level of the item or entity (integer 1-6, 'B' for Bio, or 'N' for Nanite)
 */
export declare const TechLevelSchema: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>;
