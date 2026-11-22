/**
 * A sheet's stat labels explain themselves (r4 E21): HP and AP open the
 * glossary entry a Reference tile opens, TP and Inventory their term with its
 * page cite.
 */

import { beforeAll, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { pilotFixture } from '../../../components/__tests__/fixtures'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import {
  makeEntityLookupMock,
  makeSingleUnitStore,
  makeSoftLinkStoreMock,
} from '../../../components/__tests__/mockEntityStore'
import { must } from '../../../components/__tests__/must'
import { Sheet } from '../Sheet'

beforeAll(hydrateStores)

test('each stat label on a Pilot sheet is the control that opens its meaning', () => {
  const pilot = pilotFixture({ id: 'pilot-meaning-1', name: 'Yara Voss' })
  const { container } = render(
    <Sheet
      kind="pilot"
      id={pilot.id}
      entityStore={makeEntityLookupMock([pilot])}
      softLinkStore={makeSoftLinkStoreMock()}
      store={makeSingleUnitStore('pilot', pilot)}
      readOnly
    />
  )
  for (const key of ['hp', 'ap', 'tp']) {
    const label = must(
      container.querySelector(`.su-strip__cell[data-vital="${key}"] .su-strip__label`)
    )
    expect(label.querySelector('[data-peek], [data-term]')).not.toBeNull()
  }
  const inventory = [...container.querySelectorAll('.su-strip__label')].find((label) =>
    label.textContent?.includes('Inventory')
  )
  expect(must(inventory).querySelector('[data-term]')).not.toBeNull()
})
