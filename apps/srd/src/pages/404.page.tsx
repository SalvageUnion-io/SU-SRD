/**
 * `/404` — the not-found page. Port of `404.astro`.
 *
 * Emitted as `dist/404.html`, NOT `dist/404/index.html`: Astro special-cases it
 * so the host can serve it directly. See the URL -> file table in
 * `ssg/DESIGN.md`.
 */

import { CatalogTile, getCatalogBg, getCatalogLabel } from 'component-lib'
import type { PageModule, PageResult } from '../../ssg/types'
import { schemaHref } from '../lib/entityHref'
import { getEntitySchemas } from '../lib/gameData'

function page(): PageResult {
  const schemas = getEntitySchemas().slice(0, 6)

  return {
    meta: {
      title: '404 - Page Not Found - Salvage Union System Reference Document',
      description: 'The page you are looking for could not be found.',
      noindex: true,
    },
    children: (
      <div className="flex w-full flex-1 flex-col justify-center py-12">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6">
          <div className="text-center">
            <h1 className="text-8xl font-bold text-rust">404</h1>
            <p className="mt-2 text-sm uppercase tracking-caps-snug text-rust">
              Salvage Operation Failed
            </p>
          </div>

          <p className="text-center text-sm text-ink">
            The page you're looking for has been lost to the wastes. It might have been scrapped,
            relocated, or never existed in the first place.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CatalogTile href="/" name="Return to Home" variant="ghost" />
            {schemas.map((schema) => (
              <CatalogTile
                key={schema.id}
                href={schemaHref(schema.id)}
                name={schema.displayName}
                catalogBg={getCatalogBg(schema.id)}
                catalogLabel={getCatalogLabel(schema.id)}
              />
            ))}
          </div>
        </div>
      </div>
    ),
  }
}

export const notFoundPage: PageModule = {
  pattern: '/404',
  page,
}
