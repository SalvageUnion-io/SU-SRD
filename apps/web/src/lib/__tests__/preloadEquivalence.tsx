import { describe, expect, it } from 'bun:test'
import { Suspense } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { RefEntity } from 'salvageunion-reference'
import {
  getEntitySchemas,
  getEntitySlug,
  getModel,
  resetAllForTesting,
  SalvageUnionReference,
} from 'salvageunion-reference'
import { EntitySurfaceProvider, ReferenceEntityCard, Skeleton } from '../../components/index'
import { EntityListingRow } from '../../components/islands/EntityListingRow'
import { itemHref, srdHrefFor } from '../entityHref'
import { getSchemaPreloadList } from '../schemaPreloadDeps'

/**
 * Render-equivalence safety net for schemaPreloadDeps.ts (see that file's
 * header for the evidence behind each bundle). A hand-derived per-route
 * preload list is only safe if it renders *identically* to a full preload —
 * some missing-schema lookups throw, but others silently degrade (an empty
 * Map, a dropped tooltip wrapper) without throwing, so "no exception" alone
 * is not a strong enough check. This renders every entity of every schema
 * that has a route twice — once with the computed per-route list, once with
 * `'all'` — and asserts byte-identical markup. Any future change (data or
 * component) that adds a new cross-schema dependency not covered by the map
 * fails this test instead of silently shipping degraded content.
 *
 * It renders to static markup, as the SSG does: the cards run no effects, so
 * the server string is the markup a page ships, without happy-dom's cost.
 *
 * The second check covers the LISTING: `SchemaViewerIsland` loads its list
 * with `projection: 'list'` (actions without their prose), so every listing
 * row must render the same from that projection as from the full corpus.
 *
 * The per-schema loop is split across `schemaPreloadDeps.<n>.test.tsx` so the
 * parallel runner can spread it over its workers: each file runs one shard.
 */

const SHARD_COUNT = 4

/**
 * Strip React's auto-generated `useId` ids before comparing markup — they're
 * allocated per render-tree position and are not guaranteed to be identical
 * literal strings across two independent renders even when the rendered
 * content itself is identical.
 */
function normalize(html: string): string {
  return html
    .replace(/\bid="[^"]*"/g, 'id="…"')
    .replace(/aria-describedby="[^"]*"/g, 'aria-describedby="…"')
    .replace(/aria-controls="[^"]*"/g, 'aria-controls="…"')
    .replace(/aria-labelledby="[^"]*"/g, 'aria-labelledby="…"')
}

/** The SRD's surface: every entity links to its page. */
const SRD_ROUTES = { hrefFor: srdHrefFor }

function renderEntity(entity: RefEntity): string {
  return normalize(
    renderToStaticMarkup(
      <EntitySurfaceProvider value={SRD_ROUTES}>
        <Suspense fallback={<Skeleton />}>
          <ReferenceEntityCard data={entity} />
        </Suspense>
      </EntitySurfaceProvider>
    )
  )
}

/** One listing row, as `SchemaViewerIsland` renders it. */
function renderListingRow(schemaId: string, entity: RefEntity): string {
  return normalize(
    renderToStaticMarkup(
      <EntitySurfaceProvider value={{ hrefFor: srdHrefFor }}>
        <EntityListingRow
          entity={entity}
          href={itemHref(schemaId, getEntitySlug(entity))}
          omit={['kind']}
        />
      </EntitySurfaceProvider>
    )
  )
}

/**
 * The schemas in shard `shard` of SHARD_COUNT. Largest first, dealt round-robin,
 * so the big catalogs (chassis, systems, abilities…) land in different files;
 * a new schema joins a shard on its own.
 */
function shardSchemas(shard: number) {
  return getEntitySchemas()
    .map((schema) => ({ schema, size: getModel(schema.id)?.all().length ?? 0 }))
    .sort((a, b) => b.size - a.size || a.schema.id.localeCompare(b.schema.id))
    .filter((_, index) => index % SHARD_COUNT === shard)
    .map(({ schema }) => schema)
}

export function describePreloadEquivalence(shard: number): void {
  describe('schemaPreloadDeps render-equivalence', () => {
    for (const schema of shardSchemas(shard)) {
      const preloadList = getSchemaPreloadList(schema.id)
      // 'all' means this schema is intentionally unoptimized (e.g. `guides`) —
      // nothing to verify, it already gets everything.
      if (preloadList === 'all') continue

      it(`${schema.id}: computed preload list (${preloadList.join(', ')}) renders identically to 'all'`, async () => {
        const model = getModel(schema.id)
        const entities: RefEntity[] = model?.all() ?? []
        expect(entities.length).toBeGreaterThan(0)

        try {
          resetAllForTesting()
          await SalvageUnionReference.preload('all')
          const baseline = entities.map((entity) => renderEntity(entity))

          resetAllForTesting()
          await SalvageUnionReference.preload(preloadList)
          const computed = entities.map((entity) => renderEntity(entity))

          expect(computed).toEqual(baseline)
        } finally {
          resetAllForTesting()
          await SalvageUnionReference.preload('all')
        }
      })

      it(`${schema.id}: listing rows render identically from the list projection`, async () => {
        const entities: RefEntity[] = getModel(schema.id)?.all() ?? []
        try {
          const baseline = entities.map((entity) => renderListingRow(schema.id, entity))

          resetAllForTesting()
          await SalvageUnionReference.preload(preloadList, { projection: 'list' })
          if (preloadList.includes('actions')) {
            expect(SalvageUnionReference.isLoaded('actions')).toBe(false)
          }
          const listed = entities.map((entity) => renderListingRow(schema.id, entity))

          expect(listed).toEqual(baseline)
        } finally {
          resetAllForTesting()
          await SalvageUnionReference.preload('all')
        }
      })
    }
  })
}
