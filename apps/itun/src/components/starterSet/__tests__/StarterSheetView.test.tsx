/**
 * A Starter Set sheet, signed out: the real sheet over the template, read-only,
 * stamped with its owner, its rail inside `/starter`, and nothing to copy with
 * until the visitor signs in. The copy itself is `StarterSet.connected.test.tsx`.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { hydrateStores } from '../../__tests__/hydrateStores'
import { StarterSheetView } from '../StarterSheetView'

beforeAll(hydrateStores)

describe('a Starter Set sheet', () => {
  test('is the template’s own sheet, read-only, owned by Leyline Press', () => {
    render(<StarterSheetView kind="pilot" id="starter-pilot-bonesaw" />)

    expect(screen.getAllByText('Bonesaw').length).toBeGreaterThan(0)
    expect(screen.getByRole('note', { name: 'Starter Set reference' }).textContent).toContain(
      'owned by Leyline Press'
    )
    // Read-only: no edit affordance at all, so nothing can reach a template.
    expect(screen.queryByLabelText(/Share this pilot/i)).toBeNull()
    // Signed out, there is no copy control.
    expect(screen.queryByLabelText('Copy Bonesaw to…')).toBeNull()
  })

  test('its crewmates open as Starter Set sheets too', () => {
    render(<StarterSheetView kind="pilot" id="starter-pilot-bonesaw" />)

    const mech = screen.getByRole('link', { name: /^View Scrapper/ })
    expect(mech.getAttribute('href')).toBe('/starter/mech/starter-mech-scrapper')
  })

  test('anything not in the Starter Set says so', () => {
    render(<StarterSheetView kind="pilot" id="starter-pilot-nobody" />)
    expect(screen.getByRole('heading', { name: /isn.t in the Starter Set/ })).toBeTruthy()

    render(<StarterSheetView kind="softLink" id="starter-pilot-bonesaw" />)
    expect(screen.getAllByRole('heading', { name: /isn.t in the Starter Set/ })).toHaveLength(2)
  })
})
