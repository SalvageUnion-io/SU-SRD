/**
 * The Cantina's shell: the one HTML document every `/build/*` navigation gets,
 * rendered at build time rather than kept as a hand-written `index.html`.
 *
 * Vite takes it as the app's HTML entry (`cantinaShell` in
 * `ssg/cantinaPlugins.ts`): the build injects the hashed entry, its CSS and
 * modulepreloads and writes `dist/build/index.html`, which the Worker
 * serves and the service worker precaches; the dev server answers navigations
 * with it. Plain `createElement`, no JSX and only relative imports, because the
 * Vite config loads this module itself.
 *
 * - The app is client-rendered and a crawler runs no JavaScript, so anything a
 *   route sets at runtime is invisible to an unfurl. For the routes a player
 *   shares (`/p/:kind/:appId`, `/invite/:token`, the retired `/join/:code`) the
 *   Worker swaps the block between the `cantina:meta` markers for that thing's
 *   link preview (`worker/shellMeta.ts`); keep the markers around it.
 * - No `<link rel="canonical">` on purpose. A fixed canonical in a SPA shell
 *   claims every client route is the homepage. The Worker adds each public
 *   page's own (`worker/publicPages.ts`) for a crawler's request.
 * - The base stylesheet (the Barlow faces and the package stylesheet, shared
 *   with srd) is linked after the title by the `cantina-base-stylesheet` plugin,
 *   which alone knows its built URL.
 */
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  META_END,
  META_START,
  metaTags,
  renderTags,
  SITE_ICONS,
  THEME_COLOR,
} from '../lib/documentHead'
import { appUrl, originOf } from '../lib/site'
import { renderUnionBar } from './unionBar'

/** The product's name (`PRODUCT.name`; `lib/__tests__/productName.test.ts` holds them equal). */
const SHELL_TITLE = 'The Cantina'

/** The sitewide meta description, which the PWA manifest repeats. */
const SHELL_DESCRIPTION =
  'The Salvage Union Character Builder. Build and run Salvage Union Pilots, Mechs and Union Crawlers. Character sheets, roster management and shareable live sheets for the post-apocalyptic Mech TTRPG.'

/** The link preview's description: the meta description without its last clause. */
const PREVIEW_DESCRIPTION =
  'The Salvage Union Character Builder. Build and run Salvage Union Pilots, Mechs and Union Crawlers. Character sheets, roster management and shareable live sheets.'

/** The app's front door on production's origin; a Preview's build names its own (`shellOrigin`). */
const siteUrl = appUrl('/', originOf())
const ogImage = `${siteUrl}og-image.png`

const meta = (attrs: Record<string, string>) => createElement('meta', attrs)

/** The sitewide link-preview block: the defaults every route starts from. */
function previewTags(): string {
  return renderTags(
    metaTags({
      title: SHELL_TITLE,
      description: SHELL_DESCRIPTION,
      previewDescription: PREVIEW_DESCRIPTION,
      url: siteUrl,
      themeColor: THEME_COLOR,
      image: { url: ogImage, alt: SHELL_TITLE },
    })
  )
}

/** The head tags before the preview block: charset, viewport, the site's icons, title. */
function headTags(): string {
  return renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      meta({ charSet: 'UTF-8' }),
      meta({ name: 'viewport', content: 'width=device-width, initial-scale=1.0' }),
      ...SITE_ICONS.map((icon) => createElement('link', { key: icon.href, ...icon })),
      createElement('title', null, SHELL_TITLE)
    )
  )
}

/**
 * The body: the Union bar (`./unionBar`), the root the app mounts on, and
 * `main.tsx`, the source entry, which the build replaces with its hashed chunk
 * (and the dev server serves as is).
 */
function bodyTags(): string {
  return (
    renderUnionBar() +
    renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        createElement('div', { id: 'root' }),
        createElement('script', { type: 'module', src: '/src/main.tsx' })
      )
    )
  )
}

/** The shell as Vite's HTML entry. */
export function renderShell(): string {
  return [
    '<!doctype html>',
    '<html lang="en">',
    `<head>${headTags()}${META_START}${previewTags()}${META_END}</head>`,
    `<body>${bodyTags()}</body>`,
    '</html>',
    '',
  ].join('\n')
}
