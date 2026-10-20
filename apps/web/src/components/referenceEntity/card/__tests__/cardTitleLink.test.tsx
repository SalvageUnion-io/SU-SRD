/**
 * Linked names (owner, 2026-10-20): a card met inside another, nested or the
 * Peek's, names its own Page, as a Mini's name does. The Peek's is its
 * plate's one link (R33), out of the tab order.
 */
import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { EntityRef } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntitySurfaceProvider } from '../../../entity/EntitySurface'
import { PeekCard } from '../../../entity/PeekCard'
import { InsidePickContext } from '../insidePick'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const frost = () => {
  const system = SalvageUnionReference.Systems.getByName('Frost Protection')
  if (!system) throw new Error('fixture missing: Frost Protection')
  return system
}

const hrefFor = (ref: EntityRef) => `/${ref.schemaName}/${ref.slug}/`

const onRoutes = (children: ReactNode) => (
  <EntitySurfaceProvider value={{ hrefFor }}>{children}</EntitySurfaceProvider>
)

const linkedName = () => screen.queryByRole('link', { name: 'Open Frost Protection' })

describe('linked names', () => {
  test("a Peek's name links to its Page, out of the tab order", () => {
    render(onRoutes(<PeekCard entity={frost()} />))
    const link = linkedName()
    expect(link?.getAttribute('href')).toBe('/systems/frost-protection/')
    expect(link?.getAttribute('tabindex')).toBe('-1')
    expect(link?.hasAttribute('data-peek-open')).toBe(true)
    expect(link?.closest('.su-entity-compact__title')).not.toBeNull()
  })

  test("a Peek's name opens the app's Page where it has no route", () => {
    const openPage = mock(() => {})
    render(
      <EntitySurfaceProvider value={{ openPage }}>
        <PeekCard entity={frost()} />
      </EntitySurfaceProvider>
    )
    const opener = screen.getByRole('button', { name: 'Open Frost Protection' })
    expect(opener.getAttribute('tabindex')).toBe('-1')
    fireEvent.click(opener)
    expect(openPage).toHaveBeenCalledTimes(1)
  })

  test("a nested card's name links; its opener answers a key too", () => {
    render(onRoutes(<ReferenceEntityCard data={frost()} depth={1} size="compact" />))
    const link = linkedName()
    expect(link?.getAttribute('href')).toBe('/systems/frost-protection/')
    expect(link?.hasAttribute('data-peek-open')).toBe(false)

    const openPage = mock(() => {})
    render(
      <EntitySurfaceProvider value={{ openPage }}>
        <ReferenceEntityCard data={frost()} depth={1} size="compact" />
      </EntitySurfaceProvider>
    )
    const opener = screen.getByRole('button', { name: 'Open Frost Protection' })
    expect(opener.getAttribute('tabindex')).toBe('0')
    fireEvent.keyDown(opener, { key: 'Enter' })
    expect(openPage).toHaveBeenCalledTimes(1)
  })

  test('a card that is its own subject, a pick or a control names no Page', () => {
    const { unmount } = render(onRoutes(<ReferenceEntityCard data={frost()} />))
    expect(linkedName()).toBeNull()
    unmount()

    const picked = render(
      onRoutes(
        <InsidePickContext.Provider value={true}>
          <ReferenceEntityCard data={frost()} depth={1} />
        </InsidePickContext.Provider>
      )
    )
    expect(linkedName()).toBeNull()
    picked.unmount()

    render(onRoutes(<ReferenceEntityCard data={frost()} depth={1} onCardClick={() => {}} />))
    expect(linkedName()).toBeNull()
  })

  test('with no route and no opener the name stays text', () => {
    render(<ReferenceEntityCard data={frost()} depth={1} />)
    expect(linkedName()).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open Frost Protection' })).toBeNull()
    expect(screen.getAllByText('Frost Protection').length).toBeGreaterThan(0)
  })
})
