/**
 * `/api` — the public JSON API reference.
 *
 * Pure static prose plus one table driven by the reference dataset. The code
 * samples live in template literals rather than as JSX text: JSX collapses
 * newlines and strips per-line indentation, which would silently reflow every
 * `<pre>` block.
 */

import type { CSSProperties } from 'react'
import { getEntitySlug } from 'salvageunion-reference'
import type { PageModule, PageResult } from '../../../ssg/types'
import { InlineRef, Panel, Slab, Stack } from '../../components/index'
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from '../../design/tokens'
import { apiSampleChassis } from '../../lib/apiSample'
import { SITE_URL, WEBSITE } from '../../lib/constants'
import {
  ASIDE,
  BOLD,
  ITALIC,
  inlineCode,
  PANEL_BODY,
  PANEL_HEAD,
  PANEL_TITLE,
  PROSE,
  proseColumn,
} from '../../lib/docPageStyles'
import { itemHref, schemaHref } from '../../lib/entityHref'
import { getEntitySchemas } from '../../lib/gameData'
import { pageTitle } from '../../lib/pageTitle'
import { DocPage } from '../DocPage'

const TITLE = pageTitle('API Reference')
const DESCRIPTION =
  'Public JSON API documentation for salvageunion.io. Access Salvage Union game data programmatically via CORS-enabled JSON endpoints.'

const baseUrl = SITE_URL

const PROSE_12 = proseColumn(space[12])
/** An endpoint's example URL: a long one breaks at phone width. */
const EXAMPLE_LINK = { ...BOLD, overflowWrap: 'anywhere' } satisfies CSSProperties

const CODE = inlineCode()
const CODE_ON_GROUND = inlineCode(true)

/** A Panel header's HTTP method. */
const METHOD = {
  color: color.wkMuted,
  fontFamily: font.cond,
  fontSize: fontSize.sm,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  lineHeight: 'calc(1.25 / 0.875)',
  textTransform: 'uppercase',
} satisfies CSSProperties

/** A `<pre>` code sample; the padding is per sample. */
const CODE_SAMPLE = {
  backgroundColor: color.wkBg,
  borderRadius: radius.card,
  fontSize: fontSize.xs,
  lineHeight: 1.625,
  overflowX: 'auto',
} satisfies CSSProperties

// — The schema table. Its narrow-screen column drop is `.su-api__wide-cell`. —
const TABLE = {
  fontSize: fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
  width: '100%',
} satisfies CSSProperties

const TABLE_HEAD = {
  backgroundColor: color.ink,
  borderColor: color.wkFaint,
  borderStyle: 'solid',
  borderWidth: `0 0 ${borderWidth.pill}`,
  color: color.paper,
} satisfies CSSProperties

const TABLE_ROW = {
  borderColor: color.wkFaint,
  borderStyle: 'solid',
  borderWidth: `0 0 ${borderWidth.hairline}`,
} satisfies CSSProperties

const TD = { paddingBlock: space[8], paddingInline: space[16] } satisfies CSSProperties

const TH = {
  ...TD,
  fontFamily: font.cond,
  fontSize: fontSize.xs,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  lineHeight: 'calc(1 / 0.75)',
  textAlign: 'left',
  textTransform: 'uppercase',
} satisfies CSSProperties

const TH_END = { ...TH, textAlign: 'right' } satisfies CSSProperties

const TD_NAME = { ...TD, fontWeight: weight.medium } satisfies CSSProperties

const TD_DESCRIPTION = { ...TD, color: color.wkMuted } satisfies CSSProperties

const TD_COUNT = { ...TD, fontFamily: font.body, textAlign: 'right' } satisfies CSSProperties

const SCHEMA_ID = {
  fontFamily: font.body,
  fontSize: fontSize.xs,
  fontWeight: weight.bold,
  lineHeight: 'calc(1 / 0.75)',
} satisfies CSSProperties

/**
 * A code sample. Focusable because it scrolls: at phone width the longer
 * samples overflow sideways, and a scroll region the keyboard cannot reach
 * cannot be read without a pointer (WCAG 2.1.1 — axe's
 * `scrollable-region-focusable`, found by the first phone scan).
 */
function CodeSample({ children, roomy = false }: { children: string; roomy?: boolean }) {
  return (
    <pre
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a region that scrolls must be reachable by keyboard (WCAG 2.1.1)
      tabIndex={0}
      style={{ ...CODE_SAMPLE, padding: roomy ? space[16] : space[12] }}
    >
      <code>{children}</code>
    </pre>
  )
}

/**
 * Every sample on this page is DERIVED from a real record at build time.
 *
 * Hand-written samples are prose, and prose is not typechecked: a sample can
 * name an entity the dataset lacks (a 404), show a UUID as a slug, or document
 * fields a chassis does not have. This is the page whose readers copy-paste
 * most directly into their own code, so it never hand-writes one.
 *
 * The generator already holds the dataset in memory when it renders this page —
 * the same trick `llms.txt` uses for its category list. Deriving costs nothing
 * and the samples cannot drift from the data again.
 */

/**
 * Built inside `page()`, never at module scope.
 *
 * the `noModuleScopeReferenceCall` Biome plugin forbids a module-scope `SalvageUnionReference` call:
 * it would execute at import time, before the build's `preload()` bootstrap,
 * and throw "Schema not loaded". `page()` runs after that bootstrap.
 */
function buildSamples() {
  const entity = apiSampleChassis()
  const slug = getEntitySlug(entity)
  const name = entity.name

  /**
   * A readable excerpt of a real record: identity fields plus the first few
   * scalars, then an ellipsis. Long prose (`content`) and nested arrays are
   * skipped — the point is the SHAPE and the real field names, not a full dump.
   */
  const json = (indent: string): string => {
    const record = entity as unknown as Record<string, unknown>
    const scalars = Object.entries(record)
      .filter(([key, value]) => {
        if (key === 'schemaName') return false
        return typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string'
      })
      .slice(0, 6)
    const lines = scalars.map(
      ([key, value]) => `${indent}  ${JSON.stringify(key)}: ${JSON.stringify(value)},`
    )
    return `${lines.join('\n')}\n${indent}  ...`
  }

  return {
    slug,
    name,
    schemaArray: `[\n  {\n${json('  ')}\n  },\n  ...\n]`,
    entity: `{\n${json('')}\n}`,
    fetch: `const response = await fetch('${SITE_URL}/schema/chassis.json')
const chassis = await response.json()
console.log(chassis[0].name) // ${JSON.stringify(name)}`,
  }
}

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

const CORS_HEADERS_SAMPLE = `Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET
Content-Type: application/json`

function page(): PageResult {
  const schemas = getEntitySchemas()
  const samples = buildSamples()

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
        isPartOf: WEBSITE,
      },
    },
    children: (
      <DocPage title="JSON API Reference" measure="64rem" gap={space[32]}>
        {/* Overview */}
        <section style={PROSE_12}>
          <Slab as="h2" label="Overview" />
          <p>
            All game data on salvageunion.io is available as machine-readable JSON. The API is
            static — every endpoint is a plain file served directly from the site. No authentication
            is required.
          </p>
          <p>
            CORS is fully open (<code style={CODE}>Access-Control-Allow-Origin: *</code>
            ), so you can fetch from any origin, including browser JavaScript.
          </p>
          <p>
            <strong>Base URL:</strong> <code style={CODE}>{baseUrl}</code>
          </p>
          <p style={ASIDE}>
            <strong>Tip:</strong> every page on this site has its data under{' '}
            <code style={CODE_ON_GROUND}>/schema/</code>. For example,{' '}
            <code style={CODE_ON_GROUND}>{schemaHref('chassis')}</code> renders the HTML index, and{' '}
            <code style={CODE_ON_GROUND}>/schema/chassis.json</code> serves the raw array. The same
            applies to individual entities:{' '}
            <code style={CODE_ON_GROUND}>{itemHref('chassis', samples.slug)}</code> is the page, and{' '}
            <code style={CODE_ON_GROUND}>/schema/chassis/item/{samples.slug}.json</code> its data.
          </p>
        </section>

        {/* Endpoints */}
        <Stack as="section" gap={24}>
          <Slab as="h2" label="Endpoints" />

          {/* Schema data array */}
          <Panel soft>
            <div style={PANEL_HEAD}>
              <p style={METHOD}>GET</p>
              <p style={PANEL_TITLE}>
                /schema/<span style={ITALIC}>{'{schemaId}'}</span>.json
              </p>
            </div>
            <div style={PANEL_BODY}>
              <p>Returns the full data array for a schema. Each element is a game entity.</p>
              <p>
                <strong>Example:</strong>{' '}
                <InlineRef
                  href={`${baseUrl}/schema/chassis.json`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={EXAMPLE_LINK}
                >
                  {baseUrl}/schema/chassis.json
                </InlineRef>
              </p>
              <CodeSample>{samples.schemaArray}</CodeSample>
            </div>
          </Panel>

          {/* JSON Schema definition */}
          <Panel soft>
            <div style={PANEL_HEAD}>
              <p style={METHOD}>GET</p>
              <p style={PANEL_TITLE}>
                /schema/<span style={ITALIC}>{'{schemaId}'}</span>.schema.json
              </p>
            </div>
            <div style={PANEL_BODY}>
              <p>
                Returns the JSON Schema definition for a schema, generated from the Zod validation
                schemas used in the SRD codebase. Useful for validating data or understanding the
                shape of entity objects.
              </p>
              <p>
                <strong>Example:</strong>{' '}
                <InlineRef
                  href={`${baseUrl}/schema/chassis.schema.json`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={EXAMPLE_LINK}
                >
                  {baseUrl}/schema/chassis.schema.json
                </InlineRef>
              </p>
              <CodeSample>{JSON_SCHEMA_SAMPLE}</CodeSample>
            </div>
          </Panel>

          {/* Individual entity */}
          <Panel soft>
            <div style={PANEL_HEAD}>
              <p style={METHOD}>GET</p>
              <p style={PANEL_TITLE}>
                /schema/<span style={ITALIC}>{'{schemaId}'}</span>/item/
                <span style={ITALIC}>{'{itemId}'}</span>.json
              </p>
            </div>
            <div style={PANEL_BODY}>
              <p>
                Returns a single entity by its slug. Entity slugs are lowercase, hyphen-separated
                versions of the entity name (e.g., <code style={CODE}>{samples.name}</code> becomes{' '}
                <code style={CODE}>{samples.slug}</code>). Slugs match the page URLs on the
                reference site.
              </p>
              <p>
                <strong>Example:</strong>{' '}
                <InlineRef
                  href={`${baseUrl}/schema/chassis/item/${samples.slug}.json`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={EXAMPLE_LINK}
                >
                  {baseUrl}/schema/chassis/item/{samples.slug}.json
                </InlineRef>
              </p>
              <CodeSample>{samples.entity}</CodeSample>
            </div>
          </Panel>
        </Stack>

        {/* Usage example */}
        <Stack as="section" gap={12}>
          <Slab as="h2" label="Usage Example" />
          <p style={PROSE}>Fetch all chassis data in browser JavaScript:</p>
          <CodeSample roomy>{samples.fetch}</CodeSample>
        </Stack>

        {/* Available schemas */}
        <Stack as="section" gap={16}>
          <Slab as="h2" label="Available Schemas" />
          <p style={PROSE}>
            The following schema IDs are available. Use them in the endpoint patterns above.
          </p>

          <Panel soft className="su-api__schemas">
            <table style={TABLE}>
              <thead>
                <tr className="su-print-ink" style={TABLE_HEAD}>
                  <th style={TH}>Schema ID</th>
                  <th style={TH}>Name</th>
                  <th className="su-api__wide-cell" style={TH}>
                    Description
                  </th>
                  <th style={TH_END}>Items</th>
                </tr>
              </thead>
              <tbody>
                {schemas.map((schema, i) => (
                  <tr
                    key={schema.id}
                    style={{
                      ...TABLE_ROW,
                      backgroundColor: i % 2 === 0 ? color.paper : color.wkBg,
                    }}
                  >
                    <td style={TD}>
                      <InlineRef href={schemaHref(schema.id)} style={SCHEMA_ID}>
                        {schema.id}
                      </InlineRef>
                    </td>
                    <td style={TD_NAME}>{schema.displayNamePlural}</td>
                    <td className="su-api__wide-cell" style={TD_DESCRIPTION}>
                      {schema.description}
                    </td>
                    <td style={TD_COUNT}>{schema.itemCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </Stack>

        {/* CORS & headers */}
        <Stack as="section" gap={12}>
          <Slab as="h2" label="CORS Policy" />
          <p style={PROSE}>
            All <code style={CODE}>/schema/</code> endpoints include the following response headers:
          </p>
          <CodeSample roomy>{CORS_HEADERS_SAMPLE}</CodeSample>
          <p style={PROSE}>No preflight requests are required for standard GET requests.</p>
        </Stack>

        {/* Licensing note */}
        <section style={PROSE_12}>
          <Slab as="h2" label="Licensing" />
          <p>
            Data returned by this API is published under the{' '}
            <InlineRef
              href="https://leyline.press/pages/salvage-union-open-game-licence-1-0b"
              target="_blank"
              rel="noopener noreferrer"
              style={BOLD}
            >
              Salvage Union Open Game Licence (OGL 1.0b)
            </InlineRef>
            . Salvage Union is created and published by{' '}
            <InlineRef
              href="https://leyline.press"
              target="_blank"
              rel="noopener noreferrer"
              style={BOLD}
            >
              Leyline Press
            </InlineRef>
            .
          </p>
          <p>
            The licence covers game text and mechanics only. Entity artwork is <strong>not</strong>{' '}
            covered — those images are used on this site with special permission from Leyline Press
            and may not be redistributed. Republication of licensed text must include the legal
            notices required by the Salvage Union Open Game Licence 1.0b.
          </p>
        </section>
      </DocPage>
    ),
  }
}

export const apiPage: PageModule = {
  pattern: '/api',
  page,
}
