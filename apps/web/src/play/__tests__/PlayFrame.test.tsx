/**
 * Play's brand-colour bands wear the speckle (ruleset §3.5.1; hard rule R10): the frame sets the
 * texture once, on, for every entity form in every pane at every width,
 * while the rest of the surface (links, the Page opener) carries through.
 *
 * Uses toBeTruthy() not toBeInTheDocument() (jest-dom's matchers are not on
 * bun:test's expect).
 */

import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { EntitySurfaceProvider } from '../../components/entity/EntitySurface'
import { useEntitySurface } from '../../components/entity/entitySurfaceContext'
import { PlayFrame } from '../PlayFrame'

/** A ref no app routes by itself: only a surface's own `hrefFor` links it. */
const REF = { schemaName: 'systems', id: 'x', slug: 'x', name: 'X', synthetic: true } as const

function SurfaceProbe({ id }: { id: string }) {
  const surface = useEntitySurface()
  return (
    <span data-testid={id} data-texture={String(surface.texture)}>
      {surface.hrefFor(REF) ?? 'no-href'}
    </span>
  )
}

const PANES = [
  { value: 'centre', label: 'Centre', column: 'centre', node: <SurfaceProbe id="centre" /> },
  { value: 'start', label: 'Start', column: 'start', node: <SurfaceProbe id="start" /> },
  { value: 'end', label: 'End', column: 'end', node: <SurfaceProbe id="end" /> },
] as const

const frame = (wide = true) => (
  <PlayFrame
    wide={wide}
    bar={<SurfaceProbe id="bar" />}
    pinned={<SurfaceProbe id="pinned" />}
    panes={PANES}
    tab="centre"
    onTab={() => undefined}
    foot={null}
    labels={['Units', 'Actions', 'Side']}
  />
)

describe('PlayFrame — Play sets its texture once, speckled (R10)', () => {
  test('every pane reads a speckled surface, wide or narrow', () => {
    const wide = render(frame())
    for (const id of ['bar', 'start', 'centre', 'end']) {
      expect(wide.getByTestId(id).dataset.texture).toBe('true')
    }
    wide.unmount()
    const narrow = render(frame(false))
    for (const id of ['bar', 'pinned', 'start', 'centre', 'end']) {
      expect(narrow.getByTestId(id).dataset.texture).toBe('true')
    }
  })

  test('the surface above still reaches the forms inside', () => {
    const hrefFor = () => '/systems/x/'
    const { getByTestId } = render(
      <EntitySurfaceProvider value={{ hrefFor }}>{frame()}</EntitySurfaceProvider>
    )
    expect(getByTestId('centre').dataset.texture).toBe('true')
    expect(getByTestId('centre').textContent).toBe('/systems/x/')
  })
})

describe('PlayFrame — one layout, its panes regions from `lg` and tabs below it', () => {
  test('wide: start and centre are their columns, the end column one region; no tabs', () => {
    const { getByRole, queryByRole, queryByTestId } = render(frame())
    expect(getByRole('region', { name: 'Units' }).textContent).toContain('no-href')
    expect(getByRole('region', { name: 'Actions' })).toBeTruthy()
    expect(getByRole('region', { name: 'Side' })).toBeTruthy()
    expect(queryByRole('tablist')).toBeNull()
    expect(queryByTestId('pinned')).toBeNull()
    // In the columns' reading order, whatever the tabs' order.
    const order = [...document.querySelectorAll('.su-play-pane')].map((p) => p.id.split('-').at(-1))
    expect(order).toEqual(['start', 'centre', 'end'])
  })

  test('narrow: the panes are the tabs’ panels, the open one shown, the rest mounted, hidden', () => {
    const { getByRole, getAllByRole } = render(frame(false))
    const tabs = getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Centre', 'Start', 'End'])
    const panels = getAllByRole('tabpanel', { hidden: true })
    expect(panels).toHaveLength(3)
    const open = panels.filter((p) => !p.hidden)
    expect(open.map((p) => p.getAttribute('aria-labelledby'))).toEqual([tabs[0]?.id ?? ''])
    expect(tabs[0]?.getAttribute('aria-controls')).toBe(open[0]?.id ?? '')
    expect(getByRole('tab', { name: 'Centre' }).getAttribute('aria-selected')).toBe('true')
  })
})
