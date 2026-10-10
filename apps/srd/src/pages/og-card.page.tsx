/**
 * `/og-card` — the build-only OG-card render surface.
 *
 * A single static page that renders the link preview (`OgCard`, issue 1280)
 * for the entity named by `?schema=&item=`. `scripts/og-screenshots.ts` drives
 * chromium across every entity here after the build, screenshots the 1200 ×
 * 630 frame, and writes it to `dist/schema/{schemaId}/item/{itemId}.og.png`.
 *
 * Resolving the entity client-side (OgCardIsland) keeps the build to ONE page
 * instead of ~1,000. Excluded from the sitemap and noindexed.
 *
 * ## Why this page is `shell: 'bare'`
 *
 * It owns its whole `<html>` document. It is not a reader-facing page: it has no canonical URL, no Open Graph block, no
 * nav, no footer and no `<main>`; `ssg/__tests__/render.test.tsx` asserts that.
 * It is still a full island page though — the
 * built stylesheet and the islands entry are injected before `</head>`, which is
 * what gives the card the real component-lib styles and Barlow faces.
 *
 * ## Where the CSS comes from
 *
 * This page must not import the `@fontsource` faces or `global.css` itself: an
 * SSR-reachable `.css` import is a build hazard
 * (`ssg/DESIGN.md`, hard rule 1). `src/runtime/styles.entry.ts` already imports
 * exactly that set, and its emitted stylesheet is linked into every page, so
 * this page gets the same bytes through the sanctioned seam.
 */

import type { PageModule, PageResult } from '../../ssg/types'
import { OG_HEIGHT, OG_WIDTH } from '../lib/ogCard'
import { Island } from '../runtime/Island'

/**
 * The frame is exactly the card: 1200 × 630, at the page's top-left, so the
 * generator's element screenshot is the card and nothing else.
 */
const OG_CARD_STYLE = `html,
body {
  margin: 0;
  padding: 0;
}
#og-card {
  width: ${OG_WIDTH}px;
  height: ${OG_HEIGHT}px;
  overflow: hidden;
}`

function page(): PageResult {
  return {
    // Ignored under `shell: 'bare'` — the document below owns its own <head>.
    meta: {},
    shell: 'bare',
    children: (
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="robots" content="noindex, nofollow" />
          <title>OG card render</title>
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a build-time CSS literal, interpolating only two numeric constants */}
          <style dangerouslySetInnerHTML={{ __html: OG_CARD_STYLE }} />
        </head>
        <body>
          <div id="og-card">
            {/*
              ssr={false} — the card is resolved from the query string in the
              browser, so there is nothing to server-render, and passing no
              children keeps OgCardIsland out of the Bun SSR module graph.
            */}
            <Island name="OgCardIsland" client="load" />
          </div>
        </body>
      </html>
    ),
  }
}

export const ogCardPage: PageModule = {
  pattern: '/og-card',
  page,
}
