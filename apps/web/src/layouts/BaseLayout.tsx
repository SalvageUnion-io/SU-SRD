/**
 * BaseLayout — the page document every srd route renders into.
 *
 * Renders the whole `<html>` document except for the built asset tags and the
 * island-props script, which `ssg/document.tsx` injects into the rendered
 * string (it is the only thing that knows the Vite manifest).
 *
 * **This file must never import `.css`.** All stylesheets are imported from
 * `src/runtime/styles.entry.ts`, a client-bundle entry — see `ssg/DESIGN.md`,
 * hard rule 1. The `import type` below is erased at runtime, so it does not
 * make `ssg/` a runtime dependency of the app.
 */

import type { CSSProperties, ReactNode } from 'react'
import type { DocumentMeta, PageFoot } from '../../ssg/types'
import { BreadcrumbTrail, ChapterBandTrail, Footer } from '../components/index'
import { TopNavigation } from '../components/TopNavigation'
import { color } from '../design/tokens'
import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, SITE_URL } from '../lib/constants'
import { SITE_LINKS } from '../lib/docPages'
import { metaTags, SITE_ICONS, THEME_COLOR } from '../lib/documentHead'
import { escapeJsonForScript } from '../lib/escapeJsonForScript'
import { PAGE_MEASURE } from '../lib/pageMeasure'
import { pageTitle } from '../lib/pageTitle'
import { SITE_MANIFEST } from '../pwa'
import { Island } from '../runtime/Island'

/**
 * Pages whose own search (the home band's, the 404's) stands in for the Union
 * bar's: two fields on one page would both claim ⌘K. Keyed by the route's
 * pathname, so the 404 is `/404/` though it is emitted as `404.html`.
 */
const PAGES_WITH_SEARCH = new Set(['/', '/404/'])

/** Prefetch same-site links on hover via Speculation Rules. Browser-native, zero JS. */
const SPECULATION_RULES = JSON.stringify({
  prefetch: [{ source: 'document', where: { href_matches: '/*' }, eagerness: 'moderate' }],
})

/**
 * The page column: the bar, the content, the footer, at least a screen tall.
 * Positioned: on a phone a cited page's licence row hangs below it
 * (`.su-footer__licence`).
 */
const PAGE = {
  backgroundColor: color.paper,
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100dvh',
  position: 'relative',
} satisfies CSSProperties

/** The content, on the book's page ground, taking the column's spare height. */
const MAIN = {
  backgroundColor: color.wkBg,
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
} satisfies CSSProperties

export type BaseLayoutProps = {
  meta: DocumentMeta
  /** Pathname WITH a trailing slash — the canonical URL is built from it. */
  pathname: string
  children: ReactNode
  /** A book page's foot (chapter tone and citation); absent → the licence row alone. */
  foot?: PageFoot
}

export function BaseLayout({ meta, pathname, children, foot }: BaseLayoutProps) {
  const {
    title = pageTitle(),
    description = DEFAULT_DESCRIPTION,
    canonical,
    ogType = 'website',
    ogImage = DEFAULT_OG_IMAGE,
    ogImageAlt,
    ogTitle = title,
    ogDescription = description,
    themeColor = THEME_COLOR,
    structuredData,
    additionalStructuredData,
    noindex = false,
    componentEmbed,
    preloadImage,
    preloadImageSrcSet,
    preloadImageSizes,
    breadcrumbs,
    breadcrumbDescription,
  } = meta

  const canonicalUrl = canonical || new URL(pathname, SITE_URL).href
  const ogImageUrl = ogImage.startsWith('http') ? ogImage : new URL(ogImage, SITE_URL).href
  // The trail's links are this site's own pages, so root-relative: a Worker
  // Preview's trail stays on that Preview.
  const trail = breadcrumbs?.map((crumb) =>
    crumb.url.startsWith(SITE_URL)
      ? { ...crumb, url: crumb.url.slice(SITE_URL.length) || '/' }
      : crumb
  )

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        {/* The link-preview block every document carries (`metaTags`). All OG
            images the site emits are 1200×630 (the default banner). */}
        {metaTags({
          title: ogTitle,
          description,
          previewDescription: ogDescription,
          url: canonicalUrl,
          canonical: canonicalUrl,
          type: ogType,
          themeColor,
          image: { url: ogImageUrl, alt: ogImageAlt ?? ogTitle },
        }).map(({ tag: Tag, attrs }) => (
          <Tag key={`${Tag}:${attrs.name ?? attrs.property ?? attrs.rel}`} {...attrs} />
        ))}
        {SITE_ICONS.map((icon) => (
          <link key={icon.href} {...icon} />
        ))}
        <link rel="manifest" href={SITE_MANIFEST} />

        {/* Discord's Component Embed: a pasted link to this page renders as the
            bot's card (`src/lib/componentEmbed.ts`). Data, never run. */}
        {componentEmbed ? (
          <script
            id="discord:component-embed"
            type="application/json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Component Embed JSON, JSON.stringify + script-escaped
            dangerouslySetInnerHTML={{ __html: escapeJsonForScript(componentEmbed) }}
          />
        ) : null}

        {noindex ? <meta name="robots" content="noindex, nofollow" /> : null}

        {/*
            `imageSrcSet`/`imageSizes` are not decoration: without them this
            preload picks a different candidate than the <img> and the page
            fetches both files. See `cardImageSizes`.
         */}
        {preloadImage ? (
          <link
            rel="preload"
            href={preloadImage}
            as="image"
            imageSrcSet={preloadImageSrcSet}
            imageSizes={preloadImageSizes}
          />
        ) : null}

        {/* `escapeJsonForScript`, not bare JSON.stringify: these blocks
            interpolate entity-derived prose (itemName, the generated meta
            description, a source book's title), so a `</script` in the data
            would close this element inside <head>. Lossless — see the helper. */}
        {structuredData ? (
          <script
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD payload, JSON.stringify + script-escaped
            dangerouslySetInnerHTML={{
              __html: escapeJsonForScript(JSON.stringify(structuredData)),
            }}
          />
        ) : null}
        {/* The trail as search reads it: absolute, unlike the links above. */}
        {breadcrumbs?.length ? (
          <script
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD payload, JSON.stringify + script-escaped
            dangerouslySetInnerHTML={{
              __html: escapeJsonForScript(
                JSON.stringify({
                  '@context': 'https://schema.org',
                  '@type': 'BreadcrumbList',
                  itemListElement: breadcrumbs.map((crumb, index) => ({
                    '@type': 'ListItem',
                    position: index + 1,
                    name: crumb.name,
                    item: crumb.url,
                  })),
                })
              ),
            }}
          />
        ) : null}
        {additionalStructuredData?.map((data) => (
          <script
            key={JSON.stringify(data)}
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD payload, JSON.stringify + script-escaped
            dangerouslySetInnerHTML={{ __html: escapeJsonForScript(JSON.stringify(data)) }}
          />
        ))}

        <script
          type="speculationrules"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON payload, serialized by JSON.stringify
          dangerouslySetInnerHTML={{ __html: SPECULATION_RULES }}
        />
      </head>
      <body>
        <div style={PAGE}>
          {/*
            Skip link — WCAG 2.4.1. Must be the FIRST focusable thing in the
            document, so it sits above TopNavigation rather than inside it.
            Without it, a keyboard user traverses the home mark, the main nav
            and the breadcrumb nav before reaching content, on all 1,036 pages.
          */}
          <a href="#main-content" className="su-skip-link">
            Skip to content
          </a>
          <TopNavigation
            breadcrumbs={trail}
            breadcrumbDescription={breadcrumbDescription}
            pageHasSearch={PAGES_WITH_SEARCH.has(pathname)}
          />
          {/*
            `tabIndex={-1}` is what makes the skip link actually work. Following
            a fragment moves the browser's scroll position but NOT its focus
            unless the target is focusable, so without it the next Tab press
            resumes from the link — back at the top of the nav, which is the
            thing the user just asked to skip. It does not add <main> to the tab
            order; -1 means "focusable by script or fragment, not by Tab".
          */}
          <main id="main-content" tabIndex={-1} style={MAIN}>
            {/* The trail again for the page's band, which carries it wherever
                the bar has no room (`ChapterBandTrail`); one of the three is
                displayed at any width. */}
            <ChapterBandTrail.Provider
              value={
                trail &&
                trail.length > 0 && (
                  <nav aria-label="Breadcrumb" className="su-crumbs su-crumbs--band">
                    <BreadcrumbTrail breadcrumbs={trail} description={breadcrumbDescription} />
                  </nav>
                )
              }
            >
              {children}
            </ChapterBandTrail.Provider>
          </main>
          <Footer
            links={SITE_LINKS}
            poweredBySalvageUrl="/Powered_by_Salvage_Black.webp"
            // Every page's foot sits on the one page measure; a page with no
            // citation keeps the licence row alone.
            foot={{ tone: 'rules', ...foot, measure: PAGE_MEASURE }}
          />
        </div>
        {/* The page's one Peek: every Mention and Tag above carries only its
            entity's address, and this host shows it (no props, no SSR). It
            mounts on the first hover, press or focus on one. */}
        <Island name="PeekIsland" client="interaction" trigger="[data-peek]" />
      </body>
    </html>
  )
}
