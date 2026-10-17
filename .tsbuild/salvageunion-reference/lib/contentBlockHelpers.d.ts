/**
 * Helper functions for working with content blocks in entity data
 */
import type { RefObjectContentBlock, RefObjectDataValue } from './schemas/index';
/**
 * Replace [(CHASSIS)] placeholder with actual chassis name, prefixed with "The"
 *
 * @param text - Text that may contain [(CHASSIS)] placeholders
 * @param chassisName - Optional chassis name to replace placeholders with
 * @returns Text with placeholders replaced, or original text if no chassis name provided
 */
export declare function replaceChassisPlaceholder(text: string | undefined, chassisName?: string): string;
/**
 * Extract and parse string value from a content block
 *
 * @param block - Content block to extract string value from
 * @param chassisName - Optional chassis name to replace [(CHASSIS)] placeholders
 * @returns Parsed string value with placeholders replaced
 */
export declare function parseContentBlockString(block: RefObjectContentBlock, chassisName?: string): string;
/**
 * Resolve a data value's numeric value against an effective tech level, applying
 * its `perTechLevel` scaling ("+N per Tech Level after the first"). Used for
 * granted, TL-scalable pilot equipment (e.g. Custom Sniper Rifle damage).
 *
 * The base value is the entity's TL1 value; each tech level above the first adds
 * `perTechLevel`. A value with no `perTechLevel`, a non-numeric value, or an
 * undefined/≤1 effective level returns the base unchanged.
 *
 * @returns `{ value, scaled }` — the resolved numeric value and whether scaling
 * actually changed it (drives the "modified" highlight in the UI).
 */
export declare function resolveDataValueForTechLevel(dv: RefObjectDataValue, effectiveTechLevel: number | undefined): {
    value: number | string | undefined;
    scaled: boolean;
};
