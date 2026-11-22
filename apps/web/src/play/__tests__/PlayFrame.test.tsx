/**
 * Play's brand-colour bands wear the speckle (ruleset §3.5.1; hard rule R10): the frame sets the
 * texture once, on, for every entity form in every pane at every width,
 * while the rest of the surface (links, the Page opener) carries through.
 *
 * Uses toBeTruthy() not toBeInTheDocument() (jest-dom's matchers are not on
 * bun:test's expect).
 */

import { describe, expect, test } from 'bun:test'
import { act, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { EntitySurfaceProvider } from '../../components/entity/EntitySurface'
import { useEntitySurface } from '../../components/entity/entitySurfaceContext'
import { PlayFrame } from '../PlayFrame'
import { NOTICES_RESIZED } from '../tableNotices.model'

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

const frame = (wide = true, sheet?: ReactNode) => (
  <PlayFrame
    wide={wide}
    sheet={sheet}
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

describe('PlayFrame — a sheet on the screen (play.md §18)', () => {
  const sheet = <span data-testid="sheet">sheet</span>
  test('wide: it stands in the centre column, the centre pane kept mounted and hidden', () => {
    const { getByRole, getByTestId } = render(frame(true, sheet))
    const region = getByRole('region', { name: 'Sheet' })
    expect(region.dataset.column).toBe('centre')
    expect(region.classList.contains('su-play-sheet')).toBe(true)
    expect(getByTestId('centre').closest('section')?.hidden).toBe(true)
    expect(getByTestId('start').closest('section')?.hidden).toBe(false)
    expect(getByTestId('end').closest('section')?.hidden).toBe(false)
  })

  test('narrow: it takes the open pane’s place, the tabs kept', () => {
    const { getByRole, getByTestId } = render(frame(false, sheet))
    expect(getByTestId('sheet')).toBeTruthy()
    expect(getByTestId('centre').closest('section')?.hidden).toBe(true)
    expect(getByRole('tablist')).toBeTruthy()
  })
})

// LG-04: the pinned table notices sit above Play; when the last one is
// answered or dismissed the frame takes the room back (the page never
// scrolls, so nothing else would tell it its top moved).
describe('PlayFrame — fills the window below its top', () => {
  test('it takes back the room a dismissed notice leaves', () => {
    const { container } = render(frame())
    const host = container.querySelector('.su-play-root') as HTMLElement
    let top = 77
    host.getBoundingClientRect = () => ({ top }) as DOMRect
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(host.style.height).toBe(`${window.innerHeight - 77}px`)
    top = 0
    act(() => {
      window.dispatchEvent(new Event(NOTICES_RESIZED))
    })
    expect(host.style.height).toBe(`${window.innerHeight}px`)
  })
})

// r4 A3 (LG4-11): the first action was the 26th Tab stop.
describe('PlayFrame — a skip link is the screen’s first Tab stop', () => {
  const skipping = (onTab: (tab: string) => void) => (
    <PlayFrame
      wide={false}
      bar={<button type="button">Bar</button>}
      panes={[
        { value: 'start', label: 'Start', column: 'start', node: null },
        {
          value: 'centre',
          label: 'Centre',
          column: 'centre',
          node: (
            <button type="button" data-first>
              Use
            </button>
          ),
        },
      ]}
      tab="centre"
      onTab={onTab}
      foot={null}
      labels={['Units', 'Actions', 'Side']}
      skip={{ pane: 'centre', label: 'Skip to actions', first: '[data-first]' }}
    />
  )

  test('it comes before the bar, opens its pane and lands on the pane’s first control', () => {
    const opened: string[] = []
    const { getByRole, container } = render(skipping((tab) => opened.push(tab)))
    const link = getByRole('link', { name: 'Skip to actions' })
    expect(container.querySelector('a, button')).toBe(link)
    act(() => link.click())
    expect(opened).toEqual(['centre'])
    expect(document.activeElement).toBe(getByRole('button', { name: 'Use' }))
  })
})
