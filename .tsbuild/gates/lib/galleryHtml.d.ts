/**
 * The screenshot gallery's page (`tools/gallery.ts` writes it beside the shots): one
 * section per `GALLERY_SECTIONS` entry, each page a desktop shot with its
 * phone shot inset, then every page's link preview (og:image, og:title,
 * og:description) the way a chat client lays it out. Pure, so it is tested
 * without a browser.
 */
import type { GallerySection } from './galleryPages';
export type OgMeta = {
    title?: string;
    description?: string;
    image?: boolean;
};
export type GalleryRun = {
    sha: string;
    pr?: number;
    /** The site's base URL the pages were shot from, for the "open" links. */
    base: string;
    /** Whether the pages link out (a CI build on localhost does not). */
    linkable: boolean;
    capturedAt: string;
};
export type GalleryResult = {
    sections: readonly GallerySection[];
    /** Page slugs that have both shots. */
    shot: ReadonlySet<string>;
    og: ReadonlyMap<string, OgMeta>;
    failures: readonly string[];
};
export declare const escapeHtml: (s: string) => string;
/** The gallery page for one run. */
export declare function renderGallery(result: GalleryResult, run: GalleryRun): string;
