/**
 * `/api` — the public JSON API reference. Port of `api.astro`.
 *
 * Pure static prose plus one table driven by the reference dataset. The code
 * samples live in template literals rather than as JSX text: JSX collapses
 * newlines and strips per-line indentation, which would silently reflow every
 * `<pre>` block.
 */

import { PageHeading, Panel, Slab } from 'component-lib'
import type { PageModule, PageResult } from '../../ssg/types'
import { SITE_URL } from '../lib/constants'
import { schemaHref } from '../lib/entityHref'
import { getEntitySchemas } from '../lib/gameData'

const TITLE = 'API Reference - Salvage Union System Reference Document'
const DESCRIPTION =
  'Public JSON API documentation for salvageunion.io. Access Salvage Union game data programmatically via CORS-enabled JSON endpoints.'

const baseUrl = SITE_URL

const SCHEMA_ARRAY_SAMPLE = `[
  {
    "id": "iron-mongrel",
    "name": "Iron Mongrel",
    "hull": 30,
    "armor": 2,
    ...
  },
  ...
]`

const JSON_SCHEMA_SAMPLE = `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "name": { "type": "string" },
      ...
    }
  }
}`

const ENTITY_SAMPLE = `{
  "id": "iron-mongrel",
  "name": "Iron Mongrel",
  "hull": 30,
  "armor": 2,
  ...
}`

const FETCH_SAMPLE = `const response = await fetch('${SITE_URL}/schema/chassis.json')
const chassis = await response.json()
console.log(chassis[0].name) // "Iron Mongrel"`

const CORS_HEADERS_SAMPLE = `Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET
Content-Type: application/json`

function page(): PageResult {
  const schemas = getEntitySchemas()

  return {
    meta: {
      title: TITLE,
      description: DESCRIPTION,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        name: 'Salvage Union SRD JSON API Reference',
        description:
          'Documentation for the public JSON API endpoints available at salvageunion.io.',
        url: `${SITE_URL}/api/`,
        isPartOf: {
          '@type': 'WebSite',
          name: 'Salvage Union System Reference Document',
          url: `${SITE_URL}/`,
        },
      },
    },
    children: (
      <div className="flex w-full flex-1 flex-col py-12">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6">
          <PageHeading>JSON API Reference</PageHeading>

          {/* Overview */}
          <section className="flex flex-col gap-3 text-sm leading-relaxed">
            <Slab as="h2" variant="solid" label="Overview" />
            <p>
              All game data on salvageunion.io is available as machine-readable JSON. The API is
              static — every endpoint is a plain file served directly from the site. No
              authentication is required.
            </p>
            <p>
              CORS is fully open (
              <code className="rounded-card bg-wk-bg px-1 py-0.5">
                Access-Control-Allow-Origin: *
              </code>
              ), so you can fetch from any origin, including browser JavaScript.
            </p>
            <p>
              <strong>Base URL:</strong>{' '}
              <code className="rounded-card bg-wk-bg px-1 py-0.5">{baseUrl}</code>
            </p>
            <p className="rounded-panel border-l-4 border-rust bg-wk-bg px-4 py-3">
              <strong>Tip:</strong> appending{' '}
              <code className="rounded-card bg-paper px-1 py-0.5">.json</code> to any schema URL on
              this site returns the underlying data. For example,{' '}
              <code className="rounded-card bg-paper px-1 py-0.5">/schema/chassis</code> renders the
              HTML index, and{' '}
              <code className="rounded-card bg-paper px-1 py-0.5">/schema/chassis.json</code> serves
              the raw array. The same applies to individual entities:{' '}
              <code className="rounded-card bg-paper px-1 py-0.5">
                /schema/chassis/item/iron-mongrel.json
              </code>
              .
            </p>
          </section>

          {/* Endpoints */}
          <section className="flex flex-col gap-6">
            <Slab as="h2" variant="solid" label="Endpoints" />

            {/* Schema data array */}
            <Panel soft>
              <div className="border-b-chrome border-wk-faint px-5 py-3">
                <p className="font-cond text-sm font-bold uppercase tracking-wide text-wk-muted">
                  GET
                </p>
                <p className="mt-1 font-body text-base font-bold">
                  /schema/<span className="text-rust">{'{schemaId}'}</span>.json
                </p>
              </div>
              <div className="flex flex-col gap-3 px-5 py-4 text-sm leading-relaxed">
                <p>Returns the full data array for a schema. Each element is a game entity.</p>
                <p>
                  <strong>Example:</strong>{' '}
                  <a
                    href={`${baseUrl}/schema/chassis.json`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-rust hover:underline"
                  >
                    {baseUrl}/schema/chassis.json
                  </a>
                </p>
                <pre className="overflow-x-auto rounded-card bg-wk-bg p-3 text-xs leading-relaxed">
                  <code>{SCHEMA_ARRAY_SAMPLE}</code>
                </pre>
              </div>
            </Panel>

            {/* JSON Schema definition */}
            <Panel soft>
              <div className="border-b-chrome border-wk-faint px-5 py-3">
                <p className="font-cond text-sm font-bold uppercase tracking-wide text-wk-muted">
                  GET
                </p>
                <p className="mt-1 font-body text-base font-bold">
                  /schema/<span className="text-rust">{'{schemaId}'}</span>.schema.json
                </p>
              </div>
              <div className="flex flex-col gap-3 px-5 py-4 text-sm leading-relaxed">
                <p>
                  Returns the JSON Schema definition for a schema, generated from the Zod validation
                  schemas used in the SRD codebase. Useful for validating data or understanding the
                  shape of entity objects.
                </p>
                <p>
                  <strong>Example:</strong>{' '}
                  <a
                    href={`${baseUrl}/schema/chassis.schema.json`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-rust hover:underline"
                  >
                    {baseUrl}/schema/chassis.schema.json
                  </a>
                </p>
                <pre className="overflow-x-auto rounded-card bg-wk-bg p-3 text-xs leading-relaxed">
                  <code>{JSON_SCHEMA_SAMPLE}</code>
                </pre>
              </div>
            </Panel>

            {/* Individual entity */}
            <Panel soft>
              <div className="border-b-chrome border-wk-faint px-5 py-3">
                <p className="font-cond text-sm font-bold uppercase tracking-wide text-wk-muted">
                  GET
                </p>
                <p className="mt-1 font-body text-base font-bold">
                  /schema/<span className="text-rust">{'{schemaId}'}</span>/item/
                  <span className="text-rust">{'{itemId}'}</span>.json
                </p>
              </div>
              <div className="flex flex-col gap-3 px-5 py-4 text-sm leading-relaxed">
                <p>
                  Returns a single entity by its slug. Entity slugs are lowercase, hyphen-separated
                  versions of the entity name (e.g.,{' '}
                  <code className="rounded-card bg-wk-bg px-1 py-0.5">Iron Mongrel</code> becomes{' '}
                  <code className="rounded-card bg-wk-bg px-1 py-0.5">iron-mongrel</code>). Slugs
                  match the URLs used on the reference site.
                </p>
                <p>
                  <strong>Example:</strong>{' '}
                  <a
                    href={`${baseUrl}/schema/chassis/item/iron-mongrel.json`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-rust hover:underline"
                  >
                    {baseUrl}/schema/chassis/item/iron-mongrel.json
                  </a>
                </p>
                <pre className="overflow-x-auto rounded-card bg-wk-bg p-3 text-xs leading-relaxed">
                  <code>{ENTITY_SAMPLE}</code>
                </pre>
              </div>
            </Panel>
          </section>

          {/* Usage example */}
          <section className="flex flex-col gap-3">
            <Slab as="h2" variant="solid" label="Usage Example" />
            <p className="text-sm leading-relaxed">Fetch all chassis data in browser JavaScript:</p>
            <pre className="overflow-x-auto rounded-card bg-wk-bg p-4 text-xs leading-relaxed">
              <code>{FETCH_SAMPLE}</code>
            </pre>
          </section>

          {/* Available schemas */}
          <section className="flex flex-col gap-4">
            <Slab as="h2" variant="solid" label="Available Schemas" />
            <p className="text-sm leading-relaxed">
              The following schema IDs are available. Use them in the endpoint patterns above.
            </p>

            <Panel soft className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-wk-faint bg-ink text-paper">
                    <th className="px-4 py-2 text-left font-cond text-xs font-bold uppercase tracking-wide">
                      Schema ID
                    </th>
                    <th className="px-4 py-2 text-left font-cond text-xs font-bold uppercase tracking-wide">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left font-cond text-xs font-bold uppercase tracking-wide hidden sm:table-cell">
                      Description
                    </th>
                    <th className="px-4 py-2 text-right font-cond text-xs font-bold uppercase tracking-wide">
                      Items
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schemas.map((schema, i) => (
                    <tr
                      key={schema.id}
                      className={`border-b border-wk-faint ${i % 2 === 0 ? 'bg-paper' : 'bg-wk-bg'}`}
                    >
                      <td className="px-4 py-2">
                        <a
                          href={schemaHref(schema.id)}
                          className="font-body text-xs font-bold text-rust hover:underline"
                        >
                          {schema.id}
                        </a>
                      </td>
                      <td className="px-4 py-2 font-medium">{schema.displayNamePlural}</td>
                      <td className="px-4 py-2 text-wk-muted hidden sm:table-cell">
                        {schema.description}
                      </td>
                      <td className="px-4 py-2 text-right font-body">{schema.itemCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </section>

          {/* CORS & headers */}
          <section className="flex flex-col gap-3">
            <Slab as="h2" variant="solid" label="CORS Policy" />
            <p className="text-sm leading-relaxed">
              All <code className="rounded-card bg-wk-bg px-1 py-0.5">/schema/</code> endpoints
              include the following response headers:
            </p>
            <pre className="overflow-x-auto rounded-card bg-wk-bg p-4 text-xs leading-relaxed">
              <code>{CORS_HEADERS_SAMPLE}</code>
            </pre>
            <p className="text-sm leading-relaxed">
              No preflight requests are required for standard GET requests.
            </p>
          </section>

          {/* Licensing note */}
          <section className="flex flex-col gap-3 text-sm leading-relaxed">
            <Slab as="h2" variant="solid" label="Licensing" />
            <p>
              Data returned by this API is published under the{' '}
              <a
                href="https://leyline.press/pages/salvage-union-open-game-licence-1-0b"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-rust hover:underline"
              >
                Salvage Union Open Game Licence (OGL 1.0b)
              </a>
              . Salvage Union is created and published by{' '}
              <a
                href="https://leyline.press"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-rust hover:underline"
              >
                Leyline Press
              </a>
              .
            </p>
            <p>
              The licence covers game text and mechanics only. Entity artwork is{' '}
              <strong>not</strong> covered — those images are used on this site with special
              permission from Leyline Press and may not be redistributed. Republication of licensed
              text must include the legal notices required by the Salvage Union Open Game Licence
              1.0b.
            </p>
          </section>
        </div>
      </div>
    ),
  }
}

export const apiPage: PageModule = {
  pattern: '/api',
  page,
}
