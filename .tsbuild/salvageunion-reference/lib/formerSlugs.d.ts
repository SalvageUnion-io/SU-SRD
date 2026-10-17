/**
 * Former slugs — ADR-043, decision 4: a published slug never dies. A row whose
 * slug must go lists the old one, and every surface that takes a slug resolves
 * it to where the thing lives now (srd answers it with a 301).
 *
 * The one case in the data is a Bio-Titan that became a PATTERN of another:
 * "Hill Worm Pattern Typhon" was published as its own Bio-Titan at
 * `bio-titans/hill-worm-pattern-typhon` before it became Typhon's "Hill Worm"
 * pattern. So a former slug lives on the pattern (`formerSlugs`), is scoped to
 * its host's schema, and resolves to the host plus the pattern.
 *
 * The package barrel (`lib/index.ts`) re-exports the names consumers use.
 */
import type { RefEntity, RefEnumSchemaName, RefObjectAnyPattern } from './schemas/index';
/** A slug no row carries any more, and the pattern it now names. */
export type FormerSlug = {
    /** The retired slug, unique within `host`'s schema. */
    slug: string;
    /** The entity the pattern belongs to. */
    host: RefEntity;
    pattern: RefObjectAnyPattern;
};
/**
 * Every former slug in one schema. Only visible patterns count: a hidden
 * pattern has no page to send anyone to.
 */
export declare function formerSlugsIn(schemaName: RefEnumSchemaName | string): FormerSlug[];
/**
 * Where a retired slug points now, or null. Call it only after a live lookup
 * (`findEntityBySlug`) misses: a live row always wins, and the slug check keeps
 * a former slug from ever shadowing one.
 */
export declare function resolveFormerSlug(schemaName: RefEnumSchemaName | string, slug: string): FormerSlug | null;
