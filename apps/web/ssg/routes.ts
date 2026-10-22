/**
 * routes — the explicit route registry.
 *
 * Routes are listed here, not discovered from the filesystem. That is
 * deliberate: it is the one place to read to know what the site emits, and a
 * page that is not listed here is simply not built.
 *
 * Add a page by importing its module and appending `register(thatModule)`.
 * `register` erases the module's Params/Props generics (see `render.tsx`) so
 * the list stays a plain array without an `any` in sight.
 */

import { patternPage } from '../src/reference/pages/[schemaId]/[itemId]/pattern/[patternId].page'
import { itemPage } from '../src/reference/pages/[schemaId]/[itemId].page'
import { schemaListingPage } from '../src/reference/pages/[schemaId]/index.page'
import { notFoundPage } from '../src/reference/pages/404.page'
import { aboutPage } from '../src/reference/pages/about.page'
import { apiPage } from '../src/reference/pages/api.page'
import { botPrivacyPage } from '../src/reference/pages/bot/privacy.page'
import { botTermsPage } from '../src/reference/pages/bot/terms.page'
import { changelogPage } from '../src/reference/pages/changelog.page'
import { discordPage } from '../src/reference/pages/discord.page'
import { homebrewPage } from '../src/reference/pages/homebrew.page'
import { indexPage } from '../src/reference/pages/index.page'
import { ogCardPage } from '../src/reference/pages/og-card.page'
import { roadmapPage } from '../src/reference/pages/roadmap.page'
import { starterPage } from '../src/reference/pages/starter.page'
import type { RouteRegistration } from './render'
import { register } from './render'

export const routes: RouteRegistration[] = [
  register(indexPage),
  // The sitemap has no `/404/` entry. That rule is not URL-shaped — it is
  // declared.
  register(notFoundPage, { sitemap: false }),
  register(schemaListingPage),
  register(itemPage),
  register(patternPage),
  register(changelogPage),
  register(botPrivacyPage),
  register(botTermsPage),
  register(aboutPage),
  register(apiPage),
  register(discordPage),
  register(roadmapPage),
  register(starterPage),
  register(homebrewPage),
  // Build-only screenshot surface for the per-entity og:images. Noindexed, and
  // `sitemap: false` keeps it out of sitemap-0.xml (the URL filter in
  // ssg/sitemap.ts also drops `/og-card`).
  register(ogCardPage, { sitemap: false }),
  // `/greembeem` is not a route: it is a finished static document with no data
  // behind it any more, so it ships as `public/greembeem/index.html` and Vite
  // copies it into dist like any other public file.

  // ---------------------------------------------------------------------
  // Endpoints (llms.txt, search-index.json, schema/[schemaId].json) are NOT
  // routes — they belong in ssg/endpoints.ts.
  // ---------------------------------------------------------------------
]
