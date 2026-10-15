/**
 * What every document the app serves puts in its head, whichever renders it:
 * the SSG's `BaseLayout` for the reference pages, the Cantina's shell
 * (`../shell/shell.ts`) for `/build`. One name, one set of icons, one
 * browser-chrome colour, one link-preview block (`metaTags`), which the
 * Worker also writes into the shell for a shared page (`worker/shellMeta.ts`).
 *
 * No imports: the Vite config loads the shell, and with it this module,
 * before any `import.meta.env` exists, and the Worker bundles it.
 */

/** The site's name, as `og:site_name` gives it on every page. */
const SITE_NAME = 'Salvage Union'

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

/** What a page's link preview says: its description, `og:*` and `twitter:*`. */
export type PreviewMeta = {
  /** `og:title` and `twitter:title`. */
  title: string
  /** The meta description. */
  description: string
  /** `og:description` and `twitter:description`, when they differ from the description. */
  previewDescription?: string
  /** Absolute URL of the page: `og:url`. */
  url: string
  /** The page's canonical address, when the block carries it. */
  canonical?: string
  /** `og:type`; a website unless a page says otherwise. */
  type?: string
  /** `theme-color`: the browser chrome, and an unfurl's side bar. */
  themeColor: string
  /** The card's image, always 1200×630; without one the unfurl is text. */
  image?: { url: string; alt: string }
}

/** One element of the head, as its tag name and attributes. */
export type HeadTag = { tag: 'meta' | 'link'; attrs: Record<string, string> }

const meta = (attrs: Record<string, string>): HeadTag => ({ tag: 'meta', attrs })

/** The link-preview block every document's head carries, in one order. */
export function metaTags(page: PreviewMeta): HeadTag[] {
  const preview = page.previewDescription ?? page.description
  const image = page.image
  return [
    meta({ name: 'theme-color', content: page.themeColor }),
    meta({ name: 'description', content: page.description }),
    meta({ property: 'og:type', content: page.type ?? 'website' }),
    meta({ property: 'og:site_name', content: SITE_NAME }),
    meta({ property: 'og:title', content: page.title }),
    meta({ property: 'og:description', content: preview }),
    meta({ property: 'og:url', content: page.url }),
    ...(page.canonical
      ? [{ tag: 'link' as const, attrs: { rel: 'canonical', href: page.canonical } }]
      : []),
    ...(image
      ? [
          meta({ property: 'og:image', content: image.url }),
          meta({ property: 'og:image:width', content: '1200' }),
          meta({ property: 'og:image:height', content: '630' }),
          meta({ property: 'og:image:alt', content: image.alt }),
          meta({ name: 'twitter:card', content: 'summary_large_image' }),
          meta({ name: 'twitter:image', content: image.url }),
        ]
      : [meta({ name: 'twitter:card', content: 'summary' })]),
    meta({ name: 'twitter:title', content: page.title }),
    meta({ name: 'twitter:description', content: preview }),
  ]
}

/** Text made safe for a double-quoted HTML attribute, HTML text or XML text. */
export function escapeMarkup(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Head tags as markup, one per line, for a document written as a string. */
export function renderTags(tags: readonly HeadTag[], indent = ''): string {
  return tags
    .map(({ tag, attrs }) => {
      const pairs = Object.entries(attrs).map(([key, value]) => `${key}="${escapeMarkup(value)}"`)
      return `<${tag} ${pairs.join(' ')} />`
    })
    .join(`\n${indent}`)
}

/**
 * The markers around the shell's link-preview block, which the Worker swaps
 * for a shared page's (`worker/shellMeta.ts`).
 */
export const META_START = '<!-- cantina:meta:start -->'
export const META_END = '<!-- cantina:meta:end -->'
