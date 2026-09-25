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

import { notFoundPage } from '../src/pages/404.page'
import { aboutPage } from '../src/pages/about.page'
import { apiPage } from '../src/pages/api.page'
import { botPrivacyPage } from '../src/pages/bot/privacy.page'
import { botTermsPage } from '../src/pages/bot/terms.page'
import { changelogPage } from '../src/pages/changelog.page'
import { discordPage } from '../src/pages/discord.page'
import { greembeemPage } from '../src/pages/greembeem.page'
import { indexPage } from '../src/pages/index.page'
import { ogCardPage } from '../src/pages/og-card.page'
import { schemaListingPage } from '../src/pages/schema/[schemaId]/index.page'
import { patternPage } from '../src/pages/schema/[schemaId]/item/[itemId]/pattern/[patternId].page'
import { itemPage } from '../src/pages/schema/[schemaId]/item/[itemId].page'
import { searchPage } from '../src/pages/search.page'
import type { RouteRegistration } from './render'
import { register, registerDocument } from './render'

export const routes: RouteRegistration[] = [
  register(indexPage),
  // The sitemap has no `/404/` entry. That rule is not URL-shaped — it is
  // declared.
  register(notFoundPage, { sitemap: false }),
  register(schemaListingPage),
  register(itemPage),
  register(patternPage),
  register(changelogPage),
  register(searchPage),
  register(botPrivacyPage),
  register(botTermsPage),
  register(aboutPage),
  register(apiPage),
  register(discordPage),
  // Build-only screenshot surface for the per-entity og:images. Noindexed, and
  // `sitemap: false` keeps it out of sitemap-0.xml (the URL filter in
  // ssg/sitemap.ts also drops `/og-card`).
  register(ogCardPage, { sitemap: false }),
  // SITEMAP_EXCLUDED. A standalone document (its own <html>, its own <style>,
  // none of the site's css or js) — hence `registerDocument`, not `register`.
  // `registerDocument` is unconditionally `sitemap: false`, and ssg/sitemap.ts
  // also filters any `/greembeem` path. It is also noindexed.
  registerDocument(greembeemPage),

  // ---------------------------------------------------------------------
  // Endpoints (llms.txt, search-index.json, schema/[schemaId].json) are NOT
  // routes — they belong in ssg/endpoints.ts.
  // ---------------------------------------------------------------------
]
