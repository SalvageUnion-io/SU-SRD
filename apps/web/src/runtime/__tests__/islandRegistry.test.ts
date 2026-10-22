/**
 * Each registry entry is a lazy loader that resolves to the island component
 * its key names — the mounter (`islands.client.ts`) renders whatever comes
 * back, so a loader wired to the wrong module or export would mount the wrong
 * island (or `undefined`) on every page that emits it.
 */

import { describe, expect, test } from 'bun:test'
import { islandRegistry } from '../islandRegistry'

const modulePaths: Record<keyof typeof islandRegistry, string> = {
  SearchIsland: '../../components/islands/SearchIsland',
  MobileSearchIsland: '../../components/islands/MobileSearchIsland',
  AccountIsland: '../../components/islands/AccountIsland',
  AccountAvatarIsland: '../../components/islands/AccountIsland',
  MobileNavIsland: '../../components/islands/MobileNavIsland',
  SchemaViewerIsland: '../../components/islands/SchemaViewerIsland',
  ReferenceEntityIsland: '../../components/islands/ReferenceEntityIsland',
  RollTableIsland: '../../components/islands/RollTableIsland',
  ColumnsTableIsland: '../../components/islands/ColumnsTableIsland',
  ColophonIsland: '../../components/islands/ColophonIsland',
  DidYouMeanIsland: '../../components/islands/DidYouMeanIsland',
  OgCardIsland: '../../components/islands/OgCardIsland',
  PeekIsland: '../../components/islands/PeekIsland',
  HomebrewIsland: '../../components/islands/HomebrewIsland',
}

describe('islandRegistry', () => {
  test('names exactly the islands under components/islands', () => {
    expect(Object.keys(islandRegistry).sort()).toEqual(Object.keys(modulePaths).sort())
  })

  for (const [name, path] of Object.entries(modulePaths)) {
    test(`${name} loads its module's same-named export`, async () => {
      const loader = islandRegistry[name as keyof typeof islandRegistry]
      const component = await loader({})
      const mod: Record<string, unknown> = await import(path)
      expect(typeof component).toBe('function')
      expect(component).toBe(mod[name] as typeof component)
    })
  }
})
