/**
 * Pure logic for slug-uniqueness validation.
 *
 * Entity URLs, deep links, and lookup helpers key on `nameToSlug(name)`
 * within a schema (srd routes /[schemaId]/[slug],
 * findEntityBySlug, the Discord bot's name lookups). Two same-named entities
 * in one schema therefore SHADOW each other: only the first is reachable —
 * the second silently loses its page, JSON endpoint, og-image, and bot
 * autocomplete entry. This happened for real: two "Salvage Cache Table"
 * roll-tables (We Were Here First! p.23 vs Reclamation of the Wastes p.10)
 * collided until they were disambiguated by source.
 *
 * Cross-file collisions are fine (slugs are namespaced by schema). Entities
 * without a name (meta rows) are skipped — they slug by id, which
 * checkUniqueIds already guarantees unique.
 *
 * Pure over a caller-supplied data bag, so `tools/validate.ts` (the one CLI,
 * `--only=slugs`) and the tests share one implementation.
 */
type NamedEntity = {
    id?: string;
    name?: string;
    source?: string;
    page?: number;
};
export type SlugCollision = {
    file: string;
    slug: string;
    entities: NamedEntity[];
};
/**
 * Find every slug shared by 2+ named entities within the same data file —
 * counting a pattern's former slugs, which still answer in that file's schema.
 */
export declare function findSlugCollisions(filesByName: Record<string, unknown[]>): SlugCollision[];
export {};
