/**
 * `/api` — the Dataset API reference: v1 and its stability promise (ADR-053).
 *
 * Pure static prose plus one table driven by the reference dataset. The code
 * samples live in template literals rather than as JSX text: JSX collapses
 * newlines and strips per-line indentation, which would silently reflow every
 * `<pre>` block.
 */

import type { CSSProperties } from 'react'
import { getEntitySlug } from 'salvageunion-reference'
import type { PageModule, PageResult } from '../../../ssg/types'
import { capsLabel } from '../../components/atoms/capsLabel'
import { Chips, InlineRef, Slab, SlabSection, Stack } from '../../components/index'
import { borderWidth, color, font, fontSize, radius, space, weight } from '../../design/tokens'
import { apiSampleChassis } from '../../lib/apiSample'
import { API_V1_PATH } from '../../lib/apiV1Paths'
import { cn } from '../../lib/cn'
import { SITE_URL, WEBSITE } from '../../lib/constants'
import {
  ASIDE,
  BOLD,
  BREAKABLE_BOLD,
  ITALIC,
  inlineCode,
  PROSE,
  PROSE_12,
} from '../../lib/docPageStyles'
import { itemHref, schemaHref } from '../../lib/entityHref'
import { getEntitySchemas } from '../../lib/gameData'
import { pageTitle } from '../../lib/pageTitle'
import { DocPage } from '../DocPage'
import { DocPanel } from '../DocPanel'
import { apiV1Manifest } from '../endpoints/apiV1'

const TITLE = pageTitle('Dataset API')
const DESCRIPTION =
  'The SalvageUnion.io Dataset API, version 1: every piece of Salvage Union game data as versioned, CORS-enabled JSON with a stability promise.'

/** The v1 tree, absolute: every endpoint below sits under it. */
const BASE = `${SITE_URL}${API_V1_PATH}`

const CODE = inlineCode()
const CODE_ON_GROUND = inlineCode(true)

/** An endpoint's method, its one stamp beside its name, as an action's type is. */
const GET = <Chips chips={{ durations: ['GET'], facts: [], tags: [] }} size="compact" />

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
  fontSize: fontSize.xs,
  lineHeight: 'calc(1 / 0.75)',
  textAlign: 'left',
} satisfies CSSProperties
const TH_CAPS = capsLabel()

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
    fetch: `const response = await fetch('${BASE}/chassis.json')
const chassis = await response.json()
console.log(chassis[0].name) // ${JSON.stringify(name)}`,
    manifest: manifestSample(),
  }
}

/** The manifest's head and its first schema, as the build emits them. */
function manifestSample(): string {
  const { schemas, licence: _licence, stability: _stability, ...head } = apiV1Manifest()
  const first = JSON.stringify(schemas[0], null, 2).replace(/\n/g, '\n    ')
  const lines = Object.entries(head).map(
    ([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`
  )
  return `{\n${lines.join('\n')}\n  ...\n  "schemas": [\n    ${first},\n    ...\n  ]\n}`
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
        name: 'SalvageUnion.io Dataset API v1',
        description: 'Documentation for the versioned public JSON API at salvageunion.io/api/v1.',
        url: `${SITE_URL}/api/`,
        isPartOf: WEBSITE,
      },
    },
    children: (
      <DocPage title="Dataset API" measure="64rem" gap={space[32]}>
        {/* Overview */}
        <SlabSection as="h2" title="Overview" bodyStyle={PROSE_12} page>
          <p>
            All game data on SalvageUnion.io is available as machine-readable JSON. The API is
            static: every endpoint is a plain file served directly from the site. No authentication
            is required.
          </p>
          <p>
            CORS is fully open (<code style={CODE}>Access-Control-Allow-Origin: *</code>
            ), so you can fetch from any origin, including browser JavaScript.
          </p>
          <p>
            Every endpoint sits under <code style={CODE}>{API_V1_PATH}/</code>. Start at the
            manifest: <code style={CODE}>{BASE}/index.json</code>
          </p>
          <p style={ASIDE}>
            <strong>Tip:</strong> every page on this site has its data in the API. For example,{' '}
            <code style={CODE_ON_GROUND}>{schemaHref('chassis')}</code> renders the HTML index, and{' '}
            <code style={CODE_ON_GROUND}>{API_V1_PATH}/chassis.json</code> serves the raw array. The
            same applies to individual entities:{' '}
            <code style={CODE_ON_GROUND}>{itemHref('chassis', samples.slug)}</code> is the page, and{' '}
            <code style={CODE_ON_GROUND}>
              {API_V1_PATH}/chassis/{samples.slug}.json
            </code>{' '}
            its data.
          </p>
        </SlabSection>

        {/* Versions */}
        <SlabSection as="h2" title="Versions and stability" bodyStyle={PROSE_12} page>
          <p>
            This is <strong>version 1</strong>. Within v1, changes only add: new schemas, new
            optional fields, new entities and corrected text. A field is never removed, renamed or
            retyped, and an entity whose slug changes keeps answering at its old URL with a
            redirect.
          </p>
          <p>
            A breaking change ships as a new version at <code style={CODE}>/api/v2/</code>, served
            beside v1 rather than in its place.
          </p>
          <p>
            The manifest gives each schema a <code style={CODE}>sha256</code> of its data, so a
            client can tell what changed since it last looked without downloading everything.
          </p>
          <p style={ASIDE}>
            The older, unversioned <code style={CODE_ON_GROUND}>/schema/</code> URLs, such as{' '}
            <code style={CODE_ON_GROUND}>/schema/chassis.json</code> and{' '}
            <code style={CODE_ON_GROUND}>/schema/chassis/item/{samples.slug}.json</code>, keep
            working and serve the same files on the same terms. New code should use v1.
          </p>
        </SlabSection>

        {/* Endpoints */}
        <Stack as="section" gap={24}>
          <Slab as="h2" label="Endpoints" />

          <DocPanel title="The manifest" chips={GET}>
            <p style={BREAKABLE_BOLD}>
              <code>{API_V1_PATH}/index.json</code>
            </p>
            <p>
              Lists every schema with its name, item count, data hash and the URLs of its data and
              its JSON Schema. Start here.
            </p>
            <p>
              <strong>Example:</strong>{' '}
              <InlineRef
                href={`${BASE}/index.json`}
                target="_blank"
                rel="noopener noreferrer"
                style={BREAKABLE_BOLD}
              >
                {BASE}/index.json
              </InlineRef>
            </p>
            <CodeSample>{samples.manifest}</CodeSample>
          </DocPanel>
          <DocPanel title="Every entity of a schema" chips={GET}>
            <p style={BREAKABLE_BOLD}>
              <code>
                {API_V1_PATH}/<span style={ITALIC}>{'{schemaId}'}</span>.json
              </code>
            </p>
            <p>Returns the full data array for a schema. Each element is a game entity.</p>
            <p>
              <strong>Example:</strong>{' '}
              <InlineRef
                href={`${BASE}/chassis.json`}
                target="_blank"
                rel="noopener noreferrer"
                style={BREAKABLE_BOLD}
              >
                {BASE}/chassis.json
              </InlineRef>
            </p>
            <CodeSample>{samples.schemaArray}</CodeSample>
          </DocPanel>
          <DocPanel title="A schema's JSON Schema" chips={GET}>
            <p style={BREAKABLE_BOLD}>
              <code>
                {API_V1_PATH}/<span style={ITALIC}>{'{schemaId}'}</span>.schema.json
              </code>
            </p>
            <p>
              Returns the JSON Schema definition for a schema, generated from the Zod validation
              schemas used in this site's codebase. Its <code style={CODE}>$id</code> is its own
              URL. Useful for validating data or understanding the shape of entity objects.
            </p>
            <p>
              <strong>Example:</strong>{' '}
              <InlineRef
                href={`${BASE}/chassis.schema.json`}
                target="_blank"
                rel="noopener noreferrer"
                style={BREAKABLE_BOLD}
              >
                {BASE}/chassis.schema.json
              </InlineRef>
            </p>
            <CodeSample>{JSON_SCHEMA_SAMPLE}</CodeSample>
          </DocPanel>
          <DocPanel title="One entity" chips={GET}>
            <p style={BREAKABLE_BOLD}>
              <code>
                {API_V1_PATH}/<span style={ITALIC}>{'{schemaId}'}</span>/
                <span style={ITALIC}>{'{slug}'}</span>.json
              </code>
            </p>
            <p>
              Returns a single entity by its slug. Entity slugs are lowercase, hyphen-separated
              versions of the entity name (e.g., <code style={CODE}>{samples.name}</code> becomes{' '}
              <code style={CODE}>{samples.slug}</code>). Slugs match the page URLs on the reference
              site.
            </p>
            <p>
              <strong>Example:</strong>{' '}
              <InlineRef
                href={`${BASE}/chassis/${samples.slug}.json`}
                target="_blank"
                rel="noopener noreferrer"
                style={BREAKABLE_BOLD}
              >
                {BASE}/chassis/{samples.slug}.json
              </InlineRef>
            </p>
            <CodeSample>{samples.entity}</CodeSample>
          </DocPanel>
        </Stack>

        {/* Usage example */}
        <DocPanel title="Usage example">
          <p>Fetch all chassis data in browser JavaScript:</p>
          <CodeSample roomy>{samples.fetch}</CodeSample>
        </DocPanel>

        {/* Available schemas */}
        <Stack as="section" gap={16}>
          <Slab as="h2" label="Available Schemas" />
          <p style={PROSE}>
            The following schema IDs are available. Use them in the endpoint patterns above.
          </p>
          <p style={PROSE}>
            One more, <code style={CODE}>actions</code>, is served whole at{' '}
            <code style={CODE}>{API_V1_PATH}/actions.json</code> with its schema, but has no page
            and no per-entity files. Systems, Modules, Equipment and Abilities list their actions by
            name, and each action holds its type, cost, Range, Damage and Traits.
          </p>

          <DocPanel title="Schema IDs" flush>
            <table style={TABLE} className="su-api__schemas">
              <thead>
                <tr className="su-print-ink" style={TABLE_HEAD}>
                  <th className={TH_CAPS} style={TH}>
                    Schema ID
                  </th>
                  <th className={TH_CAPS} style={TH}>
                    Name
                  </th>
                  <th className={cn('su-api__wide-cell', TH_CAPS)} style={TH}>
                    Description
                  </th>
                  <th className={TH_CAPS} style={TH_END}>
                    Items
                  </th>
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
          </DocPanel>
        </Stack>

        {/* CORS & headers */}
        <DocPanel title="CORS policy">
          <p>
            All <code style={CODE}>{API_V1_PATH}/</code> and <code style={CODE}>/schema/</code>{' '}
            endpoints include the following response headers:
          </p>
          <CodeSample roomy>{CORS_HEADERS_SAMPLE}</CodeSample>
          <p>No preflight requests are required for standard GET requests.</p>
        </DocPanel>

        {/* Licensing note */}
        <SlabSection as="h2" title="Licensing" bodyStyle={PROSE_12} page>
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
        </SlabSection>
      </DocPage>
    ),
  }
}

export const apiPage: PageModule = {
  pattern: '/api',
  page,
}
