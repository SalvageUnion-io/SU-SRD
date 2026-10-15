/**
 * The SRD's one page measure: every page family — show pages, guides,
 * listings, search, the Contents home, the document pages and the 404 — caps
 * its band's inner row, its body and its foot at it, so the notch, the content
 * and the citation start on one gutter. It is the show page's (board 07), the
 * canon reading layout. The value is `--srd-measure` in `global.css`; the body
 * that shares it is `.srd-page-body` (`pages.css`), whose side padding is the
 * gutter inside it (16px on a phone, 24px from `sm`).
 */
export const PAGE_MEASURE = 'var(--srd-measure)'
