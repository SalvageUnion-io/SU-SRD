import { describe, it, expect, afterEach, spyOn, type Mock } from 'bun:test'
import { render, waitFor } from '@testing-library/react'
import { getEntitySchemas, getModel, getName, SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityIsland } from '../ReferenceEntityIsland'
import { resetPreloadForTests } from '../../../lib/useGameData'

const entitySchemas = getEntitySchemas()

for (const schema of entitySchemas) {
  const model = getModel(schema.id)
  if (!model) continue

  const entities = model.all()
  const firstEntity = entities[0]
  if (!firstEntity) continue

  describe(`${schema.displayName} (${schema.id})`, () => {
    for (const entity of entities) {
      const entityName = getName(entity) ?? entity.id

      it(`renders "${entityName}"`, () => {
        const { container } = render(<ReferenceEntityIsland item={entity} />)
        expect(container.textContent).toContain(entityName)
      })
    }

    it(`renders first entity in compact mode`, () => {
      const { container } = render(<ReferenceEntityIsland item={firstEntity} compact />)
      const entityName = getName(firstEntity) ?? firstEntity.id
      expect(container.textContent).toContain(entityName)
    })
  })
}

describe('static fallback stripping', () => {
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

  function insertStaticFallback(): HTMLElement {
    const el = document.createElement('div')
    el.setAttribute('data-static-fallback', '')
    el.innerHTML = '<h1>Static name</h1>'
    document.body.appendChild(el)
    return el
  }

  afterEach(() => {
    isLoadedSpy?.mockRestore()
    preloadSpy?.mockRestore()
    resetPreloadForTests()
    document.querySelectorAll('[data-static-fallback]').forEach((el) => {
      el.remove()
    })
  })

  it('removes [data-static-fallback] elements once data is ready', async () => {
    insertStaticFallback()
    render(<ReferenceEntityIsland item={sampleEntity} />)
    await waitFor(() => {
      expect(document.querySelector('[data-static-fallback]')).toBeNull()
    })
  })

  it('hides (but keeps) the fallback while data is still loading', () => {
    isLoadedSpy = spyOn(SalvageUnionReference, 'isLoaded').mockReturnValue(false)
    preloadSpy = spyOn(SalvageUnionReference, 'preload').mockReturnValue(new Promise(() => {}))
    resetPreloadForTests()

    const el = insertStaticFallback()
    render(<ReferenceEntityIsland item={sampleEntity} />)

    // Hidden immediately at hydration (no duplicate <h1> next to the skeleton)…
    expect(el.hasAttribute('hidden')).toBe(true)
    // …but not removed: if the preload never resolves the content is still in
    // the DOM rather than stripped before data arrived.
    expect(document.querySelector('[data-static-fallback]')).not.toBeNull()
  })
})
