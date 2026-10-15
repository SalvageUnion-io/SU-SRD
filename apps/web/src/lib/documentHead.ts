/**
 * What every document the app serves puts in its head, whichever renders it:
 * the SSG's `BaseLayout` for the reference pages, the Cantina's shell
 * (`../shell/shell.ts`) for `/build`. One name, one set of icons, one
 * browser-chrome colour.
 *
 * Plain values and no imports: the Vite config loads the shell, and with it
 * this module, before any `import.meta.env` exists.
 */

/** The site's name, as `og:site_name` gives it on every page. */
export const SITE_NAME = 'Salvage Union'

/**
 * The browser-chrome colour every page emits as `theme-color` unless it names
 * its own. It must equal `theme_color` in `public/site.webmanifest`, which only
 * an installed PWA reads; `constants.test.ts` holds the two together.
 */
export const THEME_COLOR = '#1b1712' // design-tokens-ignore: --color-ink-deep, spelled as the manifest spells it

/** The Cargo "SU" mark (`bun run brand`), as each page links it. */
export const SITE_ICONS = [
  { rel: 'icon', type: 'image/svg+xml', href: '/favicons/su/favicon.svg' },
  { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicons/su/favicon-32.png' },
  { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicons/su/favicon-16.png' },
  { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicons/su/favicon-180.png' },
] as const

/**
 * The same mark as the site's chrome draws it: the Union bar, the Cantina's
 * rails and link-preview cards. A `public/` file at the site's root.
 */
export const MARK_SRC = '/logos/su-cargo-dark.svg'
