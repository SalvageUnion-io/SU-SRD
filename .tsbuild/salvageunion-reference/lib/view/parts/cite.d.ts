/**
 * An entity's CITATION: the book, booklet and page it is printed on, and its
 * reprints. A cite written in an app (a wizard step's rule, a blocked
 * control's brief) comes here too, as `{ source, page }`, through `formatCite`.
 */
import type { RefMetaEntity, RefObjectAnyPattern } from '../../schemas/index';
import type { EntityCite } from '../types';
/** The name a cite prints for a book: the core book's one name, else the source as given. */
export declare function bookName(source: string): string;
/** One page, or a span of pages `[first, last]`. */
type CitePage = number | readonly [number, number];
/**
 * A cite written by hand: the book and page a rule is printed on, then the
 * pages it points the reader to (a list, a table) as `see`.
 */
export type BookCite = {
    source: string;
    page: CitePage;
    see?: readonly {
        label: string;
        page: CitePage;
    }[];
};
/** `Workshop Manual · p.18 · Pilot Stats p.20`: the book, its page, then each `see`. */
export declare function formatCite({ source, page, see }: BookCite): string;
/** A secondary printing: the book (and booklet) that reprinted it, and the page. */
export type AdditionalSource = {
    source: string;
    booklet?: string;
    page: number;
};
/**
 * `book (booklet) · p.N`, dropping absent parts; `undefined` when nothing is
 * known. The book prints by its one name (`bookName`), so an entity's cite and
 * a hand-written one name the core book alike. A booklet means something only
 * beside its source.
 */
export declare function formatProvenance(source: string | undefined, booklet: string | undefined, page: number | undefined): string | undefined;
/** The renderable printings in an `additionalSources` field; the rest dropped. */
export declare function resolveAdditionalSources(value: unknown): AdditionalSource[];
export type Provenance = {
    source: string | undefined;
    booklet: string | undefined;
    page: number | undefined;
    additionalSources: AdditionalSource[];
};
/**
 * One record's provenance, never a mix: a pattern's own when it carries a
 * source (often another book than its chassis's), else its chassis's — and the
 * reprints ride with whichever record that is.
 */
export declare function resolveProvenance(entity: RefMetaEntity, pattern?: RefObjectAnyPattern): Provenance;
/** The page's foot citation: the page, then the book and any reprints. */
export declare function entityCite(entity: RefMetaEntity, pattern?: RefObjectAnyPattern): EntityCite;
export {};
