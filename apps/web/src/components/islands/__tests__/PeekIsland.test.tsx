/**
 * The SRD's page-wide Peek: a Mention anywhere on the page shows its entity's
 * compact card, and the first Peek of a schema loads that schema with what its
 * card reads (the item page's own preload list), never the whole corpus.
 */

import type { Mock } from 'bun:test'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { itemHref } from '../../../lib/entityHref'
import { getSchemaPreloadList } from '../../../lib/schemaPreloadDeps'
import { EntitySurfaceProvider, Mention } from '../../../ui/index'
import { PeekIsland } from '../PeekIsland'

let preloadSpy: Mock<typeof SalvageUnionReference.preload> | undefined

afterEach(() => {
  preloadSpy?.mockRestore()
})

describe('PeekIsland', () => {
  test("focusing a Mention Peeks its entity, loading the schema's preload list", async () => {
    // The data is already loaded by the test preload; record the request only.
    preloadSpy = spyOn(SalvageUnionReference, 'preload').mockResolvedValue(undefined)
    const burn = SalvageUnionReference.getByNameIn('traits', 'burn')
    if (!burn) throw new Error('fixture missing: burn')
    render(
      <EntitySurfaceProvider value={{ hrefFor: (ref) => itemHref(ref.schemaName, ref.slug) }}>
        <p>
          It gains the <Mention entityRef={toEntityModel(burn).ref}>Burn</Mention> Trait.
        </p>
        <PeekIsland />
      </EntitySurfaceProvider>
    )
    const link = screen.getByRole('link', { name: 'Burn' })
    act(() => link.focus())
    const peek = await screen.findByRole('tooltip')
    await waitFor(() => expect(peek.textContent?.toLowerCase()).toContain('burn'))
    expect(preloadSpy).toHaveBeenCalledWith(getSchemaPreloadList('traits'))
  })
})
