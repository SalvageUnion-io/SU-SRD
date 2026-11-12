import type { Mock } from 'bun:test'
import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { render, waitFor } from '@testing-library/react'
import { getEntitySchemas, getModel, getName, SalvageUnionReference } from 'salvageunion-reference'
import { resetPreloadForTests } from '../../../lib/useGameData'
import { ReferenceEntityIsland, ReferenceEntityIslandClient } from '../ReferenceEntityIsland'

const entitySchemas = getEntitySchemas()

/**
 * Whether the entity has anything for its page BODY to print. A name and a
 * Tech Level alone (Camouflage Fatigues) is a whole page in its band: the
 * title and the `TECH LEVEL` cell (`EntityPageStamps`), and an empty body.
 * The band carries every chip too, so a crawler tech level's stats and
 * population leave its body empty.
 */
const BAND_ONLY = new Set([
  'id',
  'schemaName',
  'source',
  'page',
  'name',
  'techLevel',
  'additionalSources',
  'structurePoints',
  'upkeepCost',
  'upgradeCost',
  'populationMin',
  'populationMax',
])
const hasBody = (entity: object) =>
  Object.entries(entity).some(
    ([key, value]) => !BAND_ONLY.has(key) && !(Array.isArray(value) && value.length === 0)
  )

/**
 * One entity per schema: every schema's page body draws through the island. The whole corpus is rendered by the build
 * (`build-web`), so this sweep does not draw every entity a second time. The
 * entity sampled is the first with a body, so the body assertion has teeth.
 */
for (const schema of entitySchemas) {
  const model = getModel(schema.id)
  if (!model) continue

  const entities = model.all()
  const sample = entities.find(hasBody) ?? entities[0]
  if (!sample) continue
  const sampleName = getName(sample) ?? sample.id

  describe(`${schema.displayName} (${schema.id})`, () => {
    // The island is the body of the entity's page (`presentation="page"`):
    // its title is the page's chapter band, outside the island
    // (`EntityPageFrame`), so what it must render is the page body.
    it(`renders "${sampleName}" as its page's body`, () => {
      const { container } = render(<ReferenceEntityIsland item={sample} />)
      expect(container.querySelector('.su-entity-page')).not.toBeNull()
      if (hasBody(sample)) expect(container.textContent?.trim().length ?? 0).toBeGreaterThan(0)
    })
  })
}

describe('the swap over the server card', () => {
  const sampleEntity = (() => {
    for (const schema of entitySchemas) {
      const model = getModel(schema.id)
      const first = model?.all()[0]
      if (first) return first
    }
    throw new Error('no reference entities available for test')
  })()

  let isLoadedSpy: Mock<typeof SalvageUnionReference.isLoaded> | undefined
  let preloadSpy: Mock<typeof SalvageUnionReference.preload> | undefined

  afterEach(() => {
    isLoadedSpy?.mockRestore()
    preloadSpy?.mockRestore()
    resetPreloadForTests()
  })

  const served = () => (
    <ReferenceEntityIslandClient item={sampleEntity}>
      <p data-served="">Served card</p>
    </ReferenceEntityIslandClient>
  )

  it('swaps the card in over the stand-in once data is ready', async () => {
    const { container } = render(served())
    await waitFor(() => {
      expect(container.querySelector('.su-entity-page')).not.toBeNull()
    })
    expect(container.querySelector('[data-served]')).toBeNull()
  })

  it('keeps the stand-in, with no skeleton, while data is loading', () => {
    isLoadedSpy = spyOn(SalvageUnionReference, 'isLoaded').mockReturnValue(false)
    preloadSpy = spyOn(SalvageUnionReference, 'preload').mockReturnValue(new Promise(() => {}))
    resetPreloadForTests()

    const { container } = render(served())
    expect(container.querySelector('[data-served]')).not.toBeNull()
    expect(container.querySelector('.su-entity-page')).toBeNull()
  })

  it('keeps the stand-in readable when the data fails to load', async () => {
    isLoadedSpy = spyOn(SalvageUnionReference, 'isLoaded').mockReturnValue(false)
    preloadSpy = spyOn(SalvageUnionReference, 'preload').mockRejectedValue(new Error('offline'))
    resetPreloadForTests()

    const { container } = render(served())
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(container.querySelector('[data-served]')).not.toBeNull()
    expect(container.textContent).not.toContain('Try again')
  })
})
