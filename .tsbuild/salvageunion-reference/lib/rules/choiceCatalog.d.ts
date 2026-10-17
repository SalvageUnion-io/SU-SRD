import type { RefMetaEntity, RefObjectChoice } from '../schemas/index';
/**
 * Resolve the entities a catalog choice offers.
 *
 * - A shortlist choice resolves its named entities across the schema(s).
 * - A schema-only choice resolves the whole collection, narrowed by `filter`.
 * - When `opts.techLevel` is a number, entities carrying a higher numeric
 *   `techLevel` are dropped (the crawler mounts its Tech Level or lower).
 *
 * Returns `[]` for any non-catalog choice, or a catalog with no schema.
 */
export declare function resolveCatalogChoiceEntities(choice: RefObjectChoice, opts?: {
    techLevel?: number;
}): RefMetaEntity[];
/**
 * Whether a choice is a **schema-only** catalog — "pick any entity from the
 * collection" (no fixed shortlist). These render as an entity listing; a
 * shortlist catalog renders as an option-card grid instead.
 */
export declare function isSchemaOnlyCatalogChoice(choice: RefObjectChoice): boolean;
