/**
 * The app's shell: the one HTML document every `/build/*` navigation gets,
 * rendered at build time rather than kept as a hand-written `index.html`.
 *
 * Vite takes it as the app's HTML entry (`appShell` in
 * `ssg/appPlugins.ts`): the build injects the hashed entry, its CSS and
 * modulepreloads and writes `dist/build/index.html`, which the Worker
 * serves and the service worker precaches; the dev server answers navigations
 * with it. Plain `createElement`, no JSX and only relative imports, because the
 * Vite config loads this module itself.
 *
 * - The app is client-rendered and a crawler runs no JavaScript, so anything a
 *   route sets at runtime is invisible to an unfurl. For the routes a player
 *   shares (`/p/:kind/:appId`, `/invite/:token`, the retired `/join/:code`) the
 *   Worker swaps the block between the `app:meta` markers for that thing's
 *   link preview (`worker/shellMeta.ts`); keep the markers around it.
 * - No `<link rel="canonical">` on purpose. A fixed canonical in a SPA shell
 *   claims every client route is the homepage. The Worker adds each public
 *   page's own (`worker/publicPages.ts`) for a crawler's request.
 * - The base stylesheet (the Barlow faces and the package stylesheet, shared
 *   with srd) is linked after the title by the `app-base-stylesheet` plugin,
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
import { areaTitle } from '../lib/pageTitle'
import { appUrl, originOf } from '../lib/site'
import { renderUnionBar } from './unionBar'

/** Build's name (`PRODUCT.build`; `lib/__tests__/productName.test.ts` holds them equal). */
const BUILD_NAME = 'Training Bay'
/** Play's name (`PRODUCT.play`; held equal by the same test). */
const PLAY_NAME = 'The Cantina'

/** Build's title, which every route starts from: the shell opens on Build's front door. */
const SHELL_TITLE = areaTitle(BUILD_NAME)

/** The app's meta description: the site's character manager, by its two areas. */
const SHELL_DESCRIPTION = `SalvageUnion.io's character manager: build Salvage Union Pilots, Mechs and Union Crawlers in the ${BUILD_NAME} and play them in ${PLAY_NAME}, with character sheets, rosters and shareable live sheets.`

/** The link preview's description: the meta description without its last clause. */
const PREVIEW_DESCRIPTION = `SalvageUnion.io's character manager: build Salvage Union Pilots, Mechs and Union Crawlers in the ${BUILD_NAME} and play them in ${PLAY_NAME}.`

/** The app's front door on production's origin; a Preview's build names its own (`shellOrigin`). */
const siteUrl = appUrl('/', originOf())
/** The site's own link preview (`public/og-image.png`), the reference pages' default too. */
const ogImage = `${originOf()}/og-image.png`

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
