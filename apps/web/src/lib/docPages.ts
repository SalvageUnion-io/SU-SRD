/**
 * The site's own pages every page foot and menu links to: the reference
 * pages' footer, the Cantina's footer, phone drawer and account menu, and the
 * account menu on the reference pages all read these. Root-relative: they are
 * pages of this origin, whichever deployment served it.
 */
export const DOC_PAGES = {
  changelog: { label: 'Changelog', href: '/changelog/' },
  api: { label: 'API', href: '/api/' },
  discord: { label: 'Discord', href: '/discord/' },
  about: { label: 'About', href: '/about/' },
} as const

/** The footer's links, in its order. */
export const SITE_LINKS = [DOC_PAGES.changelog, DOC_PAGES.api, DOC_PAGES.discord, DOC_PAGES.about]

/** "Buy the game": Leyline Press's store, the Union bar's one link off the site. */
export const BUY_HREF = 'https://leyline.press/collections/salvage-union'

/**
 * Where the Cantina's own `/about` and `/changelog` went: the site's page,
 * which the Worker 301s to (`worker/builder.ts`), so a bookmark or an old link
 * still lands. Takes a path inside the base, with or without its trailing
 * slash; null for any other path.
 */
export function retiredDocPage(path: string): string | null {
  const name = path.replace(/^\/+|\/+$/g, '')
  return name === 'about' || name === 'changelog' ? DOC_PAGES[name].href : null
}
