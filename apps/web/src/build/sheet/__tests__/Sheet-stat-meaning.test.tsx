/**
 * A sheet's stat labels explain themselves (r4 E21): HP and AP open the
 * glossary entry a Reference tile opens, TP and Inventory their term with its
 * page cite.
 */

import { beforeAll, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { mechFixture, pilotFixture } from '../../../components/__tests__/fixtures'
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

test("a Mech sheet's SYS, MODS and Cargo, and an item's Cost, open their meaning too (r5 C8)", () => {
  const mech = mechFixture({
    id: 'mech-meaning-1',
    name: 'Scuttler',
    modules: ['zoom-optics'],
  })
  const { container } = render(
    <Sheet
      kind="mech"
      id={mech.id}
      entityStore={makeEntityLookupMock([mech])}
      softLinkStore={makeSoftLinkStoreMock()}
      store={makeSingleUnitStore('mech', mech)}
      readOnly
    />
  )
  const figures = [...container.querySelectorAll('.su-strip__cell--figure .su-strip__label')]
  for (const word of ['SYS', 'MODS', 'Cargo']) {
    const label = figures.find((each) =>
      each.textContent?.toUpperCase().includes(word.toUpperCase())
    )
    expect(must(label).querySelector('[data-peek], [data-term]')).not.toBeNull()
  }
  const cost = [...container.querySelectorAll('[title="Activation cost"]')]
  expect(cost.some((each) => each.querySelector('[data-peek], [data-term]') !== null)).toBe(true)
})
