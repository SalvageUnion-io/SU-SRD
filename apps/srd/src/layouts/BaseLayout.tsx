/**
 * BaseLayout — the SSG port of `BaseLayout.astro`.
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

import { Footer } from 'component-lib'
import type { ReactNode } from 'react'
import type { DocumentMeta } from '../../ssg/types'
import { TopNavigation } from '../components/TopNavigation'
import { DEFAULT_OG_IMAGE, SITE_URL } from '../lib/constants'
import { escapeJsonForScript } from '../lib/escapeJsonForScript'

const DEFAULT_TITLE = 'Salvage Union System Reference Document'
const DEFAULT_DESCRIPTION =
  'System Reference Document (SRD) for the Salvage Union TTRPG. Complete reference guide with chassis, systems, modules, abilities, and more.'

/**
 * Mark the document as JS-capable synchronously, before first paint, so
 * `.js [data-static-fallback] { display:none }` (global.css) hides the SEO/no-JS
 * text block for JS users. Without this the naked static text painted until the
 * island mounted — a text-only flash on every entity load.
 *
 * Astro's `data-astro-rerun` attribute is deliberately gone: with real document
 * navigations (no ClientRouter) this inline script runs on every page, so there
 * is nothing to re-run.
 */
const JS_CLASS_SCRIPT = "document.documentElement.classList.add('js')"

/**
 * Replaces Astro's `prefetch: { prefetchAll: true, defaultStrategy: 'hover' }`.
 * Browser-native, zero JS.
 */
const SPECULATION_RULES = JSON.stringify({
  prefetch: [{ source: 'document', where: { href_matches: '/*' }, eagerness: 'moderate' }],
})

export type BaseLayoutProps = {
  meta: DocumentMeta
  /** Pathname WITH a trailing slash — the canonical URL is built from it. */
  pathname: string
  children: ReactNode
}

export function BaseLayout({ meta, pathname, children }: BaseLayoutProps) {
  const {
    title = DEFAULT_TITLE,
    description = DEFAULT_DESCRIPTION,
    canonical,
    ogType = 'website',
    ogImage = DEFAULT_OG_IMAGE,
    ogImageAlt,
    structuredData,
    additionalStructuredData,
    noindex = false,
    preloadImage,
    breadcrumbs,
    breadcrumbDescription,
  } = meta

  const canonicalUrl = canonical || new URL(pathname, SITE_URL).href
  const ogImageUrl = ogImage.startsWith('http') ? ogImage : new URL(ogImage, SITE_URL).href

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed inline script literal, no interpolation */}
        <script dangerouslySetInnerHTML={{ __html: JS_CLASS_SCRIPT }} />
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        {/* Cargo "SU" mark — solid ink plate, white SU + orange stripes */}
        <link rel="icon" type="image/svg+xml" href="/favicons/su/favicon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicons/su/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicons/su/favicon-16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicons/su/favicon-180.png" />
        <link rel="manifest" href="/site.webmanifest" />
        {/* Service-worker registration emitted by ssg/pwa.ts. */}
        <script defer src="/registerSW.js" />

        {/* Open Graph */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content={ogType} />
        <meta property="og:site_name" content="Salvage Union SRD" />
        {/* All OG images the site emits are 1200×630 (the default banner). */}
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={ogImageAlt ?? title} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImageUrl} />

        {noindex ? <meta name="robots" content="noindex, nofollow" /> : null}

        {preloadImage ? <link rel="preload" href={preloadImage} as="image" /> : null}

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
        <div className="flex min-h-screen flex-col bg-paper">
          {/*
            Skip link — WCAG 2.4.1. Must be the FIRST focusable thing in the
            document, so it sits above TopNavigation rather than inside it.
            Without it, a keyboard user traverses the wordmark, the main nav
            and the breadcrumb nav before reaching content, on all 1,036 pages.
          */}
          <a href="#main-content" className="su-skip-link">
            Skip to content
          </a>
          <TopNavigation
            currentPath={pathname}
            breadcrumbs={breadcrumbs}
            breadcrumbDescription={breadcrumbDescription}
          />
          {/*
            `tabIndex={-1}` is what makes the skip link actually work. Following
            a fragment moves the browser's scroll position but NOT its focus
            unless the target is focusable, so without it the next Tab press
            resumes from the link — back at the top of the nav, which is the
            thing the user just asked to skip. It does not add <main> to the tab
            order; -1 means "focusable by script or fragment, not by Tab".
          */}
          <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col bg-wk-bg">
            {children}
          </main>
          <Footer poweredBySalvageUrl="/Powered_by_Salvage_Black.webp" />
        </div>
      </body>
    </html>
  )
}
