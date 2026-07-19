import { describe, it, expect, afterEach } from 'bun:test'
import { Suspense } from 'react'
import { render, cleanup } from '@testing-library/react'
import {
  SalvageUnionReference,
  getEntitySchemas,
  getModel,
  resetAllForTesting,
  type SURefEntity,
} from 'salvageunion-reference'
import {
  ReferenceEntityCard,
  EntityHrefProvider,
  EntityDetailLinkProvider,
  CardSkeleton,
} from 'component-lib'
import { getSchemaPreloadList } from '../schemaPreloadDeps'
import { srdEntityHref } from '../entityHref'

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
 */

/**
 * Strip React's auto-generated `useId` ids before comparing markup — they're
 * allocated per render-tree position and are not guaranteed to be identical
 * literal strings across two independent `render()` calls even when the
 * rendered content itself is identical.
 */
function normalize(html: string): string {
  return html
    .replace(/\bid="[^"]*"/g, 'id="…"')
    .replace(/aria-describedby="[^"]*"/g, 'aria-describedby="…"')
    .replace(/aria-controls="[^"]*"/g, 'aria-controls="…"')
    .replace(/aria-labelledby="[^"]*"/g, 'aria-labelledby="…"')
}

function renderEntity(entity: SURefEntity): string {
  const { container, unmount } = render(
    <EntityHrefProvider value={srdEntityHref}>
      <EntityDetailLinkProvider value={true}>
        <Suspense fallback={<CardSkeleton />}>
          <ReferenceEntityCard data={entity} />
        </Suspense>
      </EntityDetailLinkProvider>
    </EntityHrefProvider>
  )
  const html = normalize(container.innerHTML)
  unmount()
  return html
}

afterEach(async () => {
  cleanup()
  resetAllForTesting()
  await SalvageUnionReference.preload('all')
})

describe('schemaPreloadDeps render-equivalence', () => {
  for (const schema of getEntitySchemas()) {
    const preloadList = getSchemaPreloadList(schema.id)
    // 'all' means this schema is intentionally unoptimized (e.g. `guides`) —
    // nothing to verify, it already gets everything.
    if (preloadList === 'all') continue

    it(`${schema.id}: computed preload list (${preloadList.join(', ')}) renders identically to 'all'`, async () => {
      const model = getModel(schema.id)
      const entities = (model?.all() ?? []) as SURefEntity[]
      expect(entities.length).toBeGreaterThan(0)

      resetAllForTesting()
      await SalvageUnionReference.preload('all')
      const baseline = entities.map((entity) => renderEntity(entity))

      resetAllForTesting()
      await SalvageUnionReference.preload(preloadList)
      const computed = entities.map((entity) => renderEntity(entity))

      expect(computed).toEqual(baseline)
    })
  }
})
