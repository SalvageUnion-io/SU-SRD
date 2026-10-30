/**
 * PEEK SIZE (E23): a Peek opens one form below its trigger's. From bare prose
 * or a Full card it is a Compact contentful (`PeekCard`); from a Compact or a
 * Mini, a Compact's self-Peek and a Mention in a compact card's prose
 * included, it is a contentful Mini (`PeekMini`). No native tooltip opens
 * beside it.
 */
import { describe, expect, test } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import type { EntityRef } from 'salvageunion-reference'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../../referenceEntity/card/ReferenceEntityCard'
import { Entity } from '../Entity'
import { EntitySurfaceProvider } from '../EntitySurface'
import { Mention } from '../forms/Mention'
import { PeekHost } from '../Peek'
import { InsidePeekContext, PEEK_SIZE_ATTRIBUTE } from '../peekContext'

const drill = () => {
  const entity = SalvageUnionReference.getByNameIn('systems', 'Salvaging Drill')
  if (!entity) throw new Error('Salvaging Drill fixture missing')
  return entity
}
const burn = (): EntityRef => {
  const trait = SalvageUnionReference.Traits.getByName('burn')
  if (!trait) throw new Error('Burn fixture missing')
  return toEntityModel(trait).ref
}

const hrefFor = (ref: EntityRef) => `/${ref.schemaName}/${ref.slug}/`

describe('Peek size', () => {
  test('a Mention in bare prose Peeks a Compact contentful', async () => {
    render(
      <EntitySurfaceProvider value={{ hrefFor }}>
        <p>
          It gains the <Mention entityRef={burn()}>Burn</Mention> Trait.
        </p>
        <PeekHost />
      </EntitySurfaceProvider>
    )
    const link = screen.getByRole('link', { name: 'Burn' })
    expect(link.hasAttribute(PEEK_SIZE_ATTRIBUTE)).toBe(false)
    act(() => link.focus())
    const peek = await screen.findByRole('tooltip')
    await waitFor(() => expect(peek.querySelector('.su-ec-frame')).not.toBeNull())
    expect(peek.querySelector('.su-entity-mini')).toBeNull()
  })

  test('a Compact Peeks itself as a contentful Mini, with no native tooltip', async () => {
    const entity = drill()
    const { container } = render(
      <EntitySurfaceProvider value={{ hrefFor }}>
        <Entity size="compact" entity={entity} mode={{ kind: 'link' }} lead peek />
        <PeekHost />
      </EntitySurfaceProvider>
    )
    const trigger = screen.getByRole('link', { name: 'Salvaging Drill' })
    expect(trigger.getAttribute(PEEK_SIZE_ATTRIBUTE)).toBe('mini')
    expect(container.querySelector('[title]')).toBeNull()
    act(() => trigger.focus())
    const peek = await screen.findByRole('tooltip')
    await waitFor(() =>
      expect(peek.querySelector('.su-entity-mini[data-contentful]')).not.toBeNull()
    )
    expect(peek.querySelector('.su-ec-frame')).toBeNull()
    expect(peek.textContent).toContain('Salvaging Drill')
  })

  test('a Compact with no Peek to open (inside a Peek) keeps its native tooltip', () => {
    const { container } = render(
      <InsidePeekContext.Provider value={true}>
        <Entity size="compact" entity={drill()} lead peek />
      </InsidePeekContext.Provider>
    )
    expect(container.querySelector('[data-peek]')).toBeNull()
    expect(container.querySelectorAll('.su-entity-compact__title[title]').length).toBe(1)
  })

  test('a Mini Peeks as a Mini', () => {
    const entity = drill()
    const { container } = render(
      <EntitySurfaceProvider value={{ hrefFor }}>
        <Entity size="mini" context="loadout" entity={entity} mode={{ kind: 'link' }} />
      </EntitySurfaceProvider>
    )
    const triggers = [...container.querySelectorAll('[data-peek]')]
    expect(triggers.length).toBeGreaterThanOrEqual(1)
    for (const trigger of triggers) expect(trigger.getAttribute(PEEK_SIZE_ATTRIBUTE)).toBe('mini')
  })

  test("a compact card's own Tags Peek Minis; a Full card's, Compacts; a nested Mini's, Minis", () => {
    const entity = drill()
    const peeksIn = (size: 'full' | 'compact') => {
      const { container, unmount } = render(
        <EntitySurfaceProvider value={{ hrefFor }}>
          <ReferenceEntityCard data={entity} size={size} />
        </EntitySurfaceProvider>
      )
      const sizesOf = (selector: string) =>
        [...container.querySelectorAll(`${selector}[data-peek]`)].map((el) =>
          el.getAttribute(PEEK_SIZE_ATTRIBUTE)
        )
      // The drill's trait Tags, and its actions as nested Minis.
      const sizes = { tags: sizesOf('.su-chip-link'), minis: sizesOf('.su-entity-mini__head') }
      unmount()
      return sizes
    }
    const full = peeksIn('full')
    expect(full.tags.length).toBeGreaterThan(0)
    for (const size of full.tags) expect(size).toBeNull()
    expect(full.minis.length).toBeGreaterThan(0)
    for (const size of full.minis) expect(size).toBe('mini')
    const compact = peeksIn('compact').tags
    expect(compact.length).toBeGreaterThan(0)
    for (const size of compact) expect(size).toBe('mini')
  })
})
