/**
 * `/og-card` — the build-only OG-card render surface. Port of `og-card.astro`.
 *
 * A single static page that renders the REAL catalog `ReferenceEntityCard` for
 * the entity named by `?schema=&item=`, at a masonry-tile width the schema index
 * could give it. `scripts/og-screenshots.ts` drives chromium across every entity
 * here after the build, screenshots the TILE ELEMENT, and composes it onto a
 * 1200×630 canvas at `dist/schema/{schemaId}/item/{itemId}.og.png`.
 *
 * The tile width is not fixed: the generator re-measures the card at each
 * candidate width and re-sets `--tileWidth` on the frame to whichever one fills
 * the canvas best (see `pickTileWidth`). CATALOG_TILE_MIN_WIDTH below is only
 * the default this page loads at.
 *
 * Resolving the entity client-side (OgCardIsland) keeps the build to ONE page
 * instead of ~1,000. Excluded from the sitemap and noindexed.
 *
 * ## Why this page is `shell: 'bare'`
 *
 * It owns its whole `<html>` document, exactly as the Astro original did. It is
 * not a reader-facing page: it has no canonical URL, no Open Graph block, no
 * nav, no footer and no `<main>`. The parity gate used to compare every one of
 * those against the Astro baseline; with it retired, `ssg/__tests__/render.test.tsx`
 * is what asserts none of them appear. It is still a full island page though — the
 * built stylesheet and the islands entry are injected before `</head>`, which is
 * what makes the screenshotted tile the real, Tailwind-styled Catalog card.
 *
 * ## Where the CSS comes from
 *
 * `og-card.astro` imported the seven `@fontsource` faces and `global.css`
 * itself. It must not here: an SSR-reachable `.css` import is a build hazard
 * (`ssg/DESIGN.md`, hard rule 1). `src/runtime/styles.entry.ts` already imports
 * exactly that set, and its emitted stylesheet is linked into every page, so
 * this page gets the same bytes through the sanctioned seam.
 */

import type { PageModule, PageResult } from '../../ssg/types'
import { CATALOG_TILE_MIN_WIDTH, CATALOG_TILE_PADDING } from '../lib/ogCard'
import { Island } from '../runtime/Island'

/**
 * Astro's `define:vars` pushed these two values into the style block as custom
 * properties; written out explicitly here, on `:root`, which is the shape the
 * generator's comment below already assumes.
 *
 * The rest is `og-card.astro`'s style block verbatim.
 *
 * One ordering note, since this block is emitted BEFORE the injected
 * stylesheet link rather than after it as Astro emitted it: the only
 * declaration that competes with `global.css` is `body { background-color }`
 * (both unlayered, both specificity 0-0-1), so global.css now wins that one.
 * It is cosmetic and never photographed — the capture is scoped to `#og-card`,
 * whose ID rule (0-1-0, and unmatched by anything in global.css) wins
 * regardless of order, and the generator reads its matte colour off that same
 * element.
 */
const OG_CARD_STYLE = `:root {
  --tileWidth: ${CATALOG_TILE_MIN_WIDTH}px;
  --tilePad: ${CATALOG_TILE_PADDING}px;
}
html,
body {
  margin: 0;
  padding: 0;
}
/* The tile is screenshotted as an ELEMENT, so the page only has to lay it
   out at the right width. The frame carries \`--color-wk-bg\` — the surface
   the schema index puts behind its tiles — so any transparency in the card
   composites exactly as it does in the Catalog view, and the generator
   reads this same computed colour to matte the canvas.

   Set on #og-card rather than <body>: global.css styles \`body\` with an
   unlayered rule, which beats Tailwind's layered utilities, so a
   \`bg-wk-bg\` class there would silently lose to the page background. */
/* content-box so the CONTENT is exactly the tile width and the padding sits
   outside it — the tile must lay out at its true index-page width.

   \`--tileWidth\` is re-set on this element by the generator once per entity
   (custom properties inherit, so an element-level value beats the :root
   default written above), which is the seam the wide-card fit uses to
   re-flow the same card at a different masonry width. */
#og-card {
  box-sizing: content-box;
  width: var(--tileWidth);
  padding: var(--tilePad);
  background-color: var(--color-wk-bg);
}
body {
  background-color: var(--color-wk-bg);
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
              ssr={false} — the tile is resolved from the query string in the
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
