/**
 * The app's shell: the one HTML document every `/build/*` navigation gets,
 * rendered at build time rather than kept as a hand-written `index.html`.
 *
 * The build writes it as a page (`astro/pages/build/index.astro`), which
 * bundles the entry, its CSS and modulepreloads into `dist/build/index.html`;
 * the Worker serves it and the service worker precaches it. The dev server
 * answers navigations with it (`appShellInDev`). Plain `createElement`, no JSX
 * and only relative imports, because the Astro config loads this module.
 *
 * - The app is client-rendered and a crawler runs no JavaScript, so anything a
 *   route sets at runtime is invisible to an unfurl. For the routes a player
 *   shares (`/p/:kind/:appId`, `/play/invite/:token`) the
 *   Worker swaps the block between the `app:meta` markers for that thing's
 *   link preview (`worker/shellMeta.ts`); keep the markers around it.
 * - No `<link rel="canonical">` on purpose. A fixed canonical in a SPA shell
 *   claims every client route is the homepage. The Worker adds each public
 *   page's own (`worker/publicPages.ts`) for a crawler's request.
 * - The base stylesheet (the Barlow faces and the package stylesheet, shared
 *   with the reference site) is linked after the title, by the page in the
 *   build and by `baseStylesheetLink` in dev.
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
const SHELL_DESCRIPTION = `SalvageUnion.io's character manager for the Salvage Union TTRPG: build Pilots, Mechs and Union Crawlers in the ${BUILD_NAME} and play them in ${PLAY_NAME}, with character sheets, rosters and shareable live sheets.`

/** The link preview's description: the meta description without its last clause. */
const PREVIEW_DESCRIPTION = `SalvageUnion.io's character manager for the Salvage Union TTRPG: build Pilots, Mechs and Union Crawlers in the ${BUILD_NAME} and play them in ${PLAY_NAME}.`

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
 * (and the dev server serves as is). The build's root holds the front door's
 * markup (`root`, `astro/build/frontDoor.tsx`), which the app's first render
 * replaces.
 */
function bodyMarkup(root = ''): string {
  return `${renderUnionBar()}<div id="root">${root}</div>`
}

function bodyTags(): string {
  return (
    bodyMarkup() +
    renderToStaticMarkup(createElement('script', { type: 'module', src: '/src/main.tsx' }))
  )
}

/**
 * The shell's head and body without its entry script, for the build's page
 * (`astro/pages/build/index.astro`), which bundles the entry itself; `root`
 * is the markup its root starts with.
 */
export function shellParts(root = ''): { head: string; body: string } {
  return { head: `${headTags()}${META_START}${previewTags()}${META_END}`, body: bodyMarkup(root) }
}

/** The shell as the dev server serves it, its entry from source (`appShellInDev`). */
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
