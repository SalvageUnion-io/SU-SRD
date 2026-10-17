/**
 * The pages the screenshot gallery shoots (`tools/gallery.ts`): the screens worth a
 * reviewer's look, grouped the way the gallery prints them. Every path is on
 * the one site, the Cantina's under `BUILDER_BASE`; `signedIn` pages are
 * reached through a seeded test account (`tools/gallery.ts` copies three
 * Starter Set characters to its Shelves), and their `path` may name a seeded
 * entity by kind (`:pilot`, `:mech`, `:crawler`, `:game`), resolved once the
 * seed has run.
 */
/** Where the Cantina is served on the site (ADR-048). */
export declare const BUILDER_BASE = "/build";
/** True for a path the Cantina serves (under `BUILDER_BASE`). */
export declare const isBuilderPath: (path: string) => boolean;
export type GalleryPage = {
    path: string;
    name: string;
    note: string;
    chips?: readonly string[];
    /** Reached through the seeded test account, after the seed. */
    signedIn?: boolean;
    /** A sheet opened in Edit (its Read | Edit switch). */
    edit?: boolean;
};
export type GallerySection = {
    id: string;
    title: string;
    /** A CSS colour for the section's band. */
    tone: string;
    intro: string;
    pages: readonly GalleryPage[];
};
export declare const GALLERY_SECTIONS: readonly GallerySection[];
/** A page's file stem: `in-` when signed in, then its path, lowercase and dashed. */
export declare function pageSlug(page: Pick<GalleryPage, 'path' | 'signedIn'>): string;
