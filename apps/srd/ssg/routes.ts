/**
 * routes — the explicit route registry.
 *
 * Astro discovered routes from the filesystem; this file lists them. That is
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
  register(notFoundPage),
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
  // Build-only screenshot surface for the per-entity og:images. Excluded from
  // the sitemap (see the filter ssg/build.ts still owes) and noindexed.
  register(ogCardPage),
  // SITEMAP_EXCLUDED. A standalone document (its own <html>, its own <style>,
  // none of the site's css or js) — hence `registerDocument`, not `register`.
  // Astro's sitemap filter dropped any path containing `/greembeem`; ssg/sitemap.ts
  // must keep dropping it. It is also noindexed.
  registerDocument(greembeemPage),

  // ---------------------------------------------------------------------
  // Endpoints (llms.txt, search-index.json, schema/[schemaId].json) are NOT
  // routes — they belong in ssg/endpoints.ts.
  // ---------------------------------------------------------------------
]
