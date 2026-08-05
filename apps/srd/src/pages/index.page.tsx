/**
 * `/` — the landing page. Port of `index.astro`.
 */

import { buildCatalogSections, CatalogTile, SectionHeader } from 'component-lib'
import type { PageModule, PageResult } from '../../ssg/types'
import { SITE_URL } from '../lib/constants'
import '../lib/gameData'

const TITLE = 'Salvage Union System Reference Document'
const DESCRIPTION =
  'System Reference Document (SRD) for the Salvage Union TTRPG. Complete reference guide with chassis, systems, modules, abilities, and more.'

function page(): PageResult {
  const categories = buildCatalogSections()

  return {
    meta: {
      title: TITLE,
      description: DESCRIPTION,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: TITLE,
        url: SITE_URL,
      },
    },
    children: (
      <div className="flex w-full flex-1 flex-col py-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4">
          {/* Visually-hidden page heading — preserves the landing-page h1 for SEO /
              accessibility now that the visible hero band is gone. Search lives in
              the top nav (and mobile nav). */}
          <h1 className="sr-only">{TITLE}</h1>

          <div className="flex flex-col gap-6">
            {categories.map((cat) => (
              <div key={cat.label}>
                <SectionHeader label={cat.label} className="mb-2" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {cat.schemas.map((card) => (
                    <CatalogTile
                      key={card.id}
                      href={card.href}
                      name={card.label}
                      catalogBg={card.catalogBg}
                      catalogLabel={card.catalogLabel}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  }
}

export const indexPage: PageModule = {
  pattern: '/',
  page,
}
