/**
 * Play's brand-colour bands wear the speckle (ruleset §3.5.1; hard rule R10): the frame sets the
 * texture once, on, for every entity form on the canvas and in the phone form,
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

const frame = (phone = <SurfaceProbe id="phone" />) => (
  <PlayFrame
    bar={<SurfaceProbe id="bar" />}
    start={<SurfaceProbe id="start" />}
    centre={<SurfaceProbe id="centre" />}
    end={<SurfaceProbe id="end" />}
    foot={null}
    labels={['Units', 'Actions', 'Side']}
    phone={phone}
  />
)

describe('PlayFrame — Play sets its texture once, speckled (R10)', () => {
  test('every column reads a speckled surface', () => {
    const { getByTestId } = render(frame())
    for (const id of ['bar', 'start', 'centre', 'end']) {
      expect(getByTestId(id).dataset.texture).toBe('true')
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
