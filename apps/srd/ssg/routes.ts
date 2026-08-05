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
import { indexPage } from '../src/pages/index.page'
import type { RouteRegistration } from './render'
import { register } from './render'

export const routes: RouteRegistration[] = [
  register(indexPage),
  register(notFoundPage),

  // ---------------------------------------------------------------------
  // TODO(migration): the remaining pages land here —
  //   about, api, changelog, discord, greembeem, og-card, search,
  //   bot/privacy, bot/terms,
  //   schema/[schemaId], schema/[schemaId]/item/[itemId],
  //   schema/[schemaId]/item/[itemId]/pattern/[patternId]
  // Endpoints (llms.txt, search-index.json, schema/[schemaId].json) are NOT
  // routes — they belong in ssg/endpoints.ts.
  // ---------------------------------------------------------------------
]
