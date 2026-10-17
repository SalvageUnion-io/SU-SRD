/**
 * Patterns: reading a host's patterns (a chassis's mech patterns, a
 * Bio-Titan's variants), the hidden-pattern rule that every render surface
 * funnels through, and pattern-name normalisation.
 *
 * The package barrel (`lib/index.ts`) re-exports the names consumers use, by
 * name.
 */
import type { RefMetaEntity, RefObjectAnyPattern, RefObjectBioTitanPattern } from './schemas/index';
/**
 * Extract patterns from an entity
 * @param entity - The entity to extract from
 * @returns The patterns or undefined
 */
export declare function getPatterns(entity: RefMetaEntity): RefObjectAnyPattern[] | undefined;
/**
 * A Bio-Titan pattern (it names the ACTIONS it adds) rather than a mech
 * pattern (it installs systems and modules). Read off the shape, not the
 * host's schema, so a surface handed a bare pattern can still tell.
 */
export declare function isBioTitanPattern(pattern: RefObjectAnyPattern): pattern is RefObjectBioTitanPattern;
/**
 * A HIDDEN pattern carries the stored `hidden` data flag — an explicit tag,
 * NEVER computed from source (project data convention; mirrors
 * `legalStarting`). The record stays in the dataset but is withheld from
 * every rendered surface. Takes the primitive the rule reads — the record's
 * `hidden` value (undefined = untagged = visible).
 */
export declare function isHiddenPattern(hidden: boolean | undefined): boolean;
/**
 * Drops the stored-`hidden` set from a chassis's patterns. This is the single
 * choke point every render surface goes through, so a pattern tagged `hidden`
 * cannot leak into a card, a generated page, a wizard picker or a bot embed.
 */
export declare function visiblePatterns<T extends {
    hidden?: boolean;
}>(patterns: readonly T[]): T[];
/**
 * Normalize pattern name by removing " Pattern" suffix
 * @param patternName - The pattern name to normalize
 * @returns The normalized pattern name
 */
export declare function normalizePatternName(patternName: string): string;
