/**
 * R70: a sheet's related units (crew, mech, crawler, companions) are one
 * section, drawn in Read even when nothing is linked, with a place to fill for
 * each slot. Every kind is rendered through `Sheet` in Read: the pilot with
 * its ability-granted companion, the mech with its chassis's drone, each
 * companion linking to its own page.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { render, within } from '@testing-library/react'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { crawlerFixture, mechFixture, pilotFixture } from '../../../components/__tests__/fixtures'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import {
  makeEntityLookupMock,
  makeSoftLinkStoreMock,
} from '../../../components/__tests__/mockEntityStore'
import { must } from '../../../components/__tests__/must'
import { mechPartnerSeeds, pilotPartnerSeeds, syncPartners } from '../../../lib/rules/partnerGrants'
import { Sheet } from '../Sheet'
import { SheetModeContext } from '../sheetMode.model'

beforeEach(hydrateStores)

const READ = { editing: false, setEditing: () => undefined }

function partners(seeds: Parameters<typeof syncPartners>[1]) {
  return must(syncPartners(undefined, seeds, { reseedLoadout: true }))
}

const pilot: Pilot = pilotFixture({
  id: 'p-rel',
  name: 'Bonesaw',
  equipment: ['survey-drone'],
  partners: partners(pilotPartnerSeeds(['survey-drone'])),
})
const mech: Mech = mechFixture({
  id: 'm-rel',
  name: 'Custos',
  chassisRef: 'little-sestra',
  partners: partners(mechPartnerSeeds('little-sestra', 'Surveyor')),
})
const crawler = crawlerFixture({ id: 'c-rel', name: 'Tenacity' })

function readSheet(kind: 'pilot' | 'mech' | 'crawler', id: string, readOnly = false) {
  render(
    <SheetModeContext.Provider value={READ}>
      <Sheet
        kind={kind}
        id={id}
        entityStore={makeEntityLookupMock([pilot, mech, crawler])}
        softLinkStore={makeSoftLinkStoreMock([])}
        readOnly={readOnly}
      />
    </SheetModeContext.Provider>
  )
  // The section's id names its head; the section is what holds it.
  const section = document.getElementById('linked-units')?.closest('section')
  expect(section).toBeTruthy()
  return section as HTMLElement
}

describe('R70: Related units in Read', () => {
  test('a pilot with nothing linked draws a place per slot, and its companion', () => {
    const section = readSheet('pilot', 'p-rel')
    expect(section.textContent).toContain('Related units')
    expect(section.textContent).toContain('No mech')
    expect(section.textContent).toContain('No crawler')
    const companion = must(pilot.partners?.[0])
    expect(
      within(section)
        .getByRole('link', { name: /Survey Drone/ })
        .getAttribute('href')
    ).toBe(`/pilots/p-rel/companions/${companion.id}`)
  })

  test('a mech with nothing linked draws a place per slot, and its chassis drone', () => {
    const section = readSheet('mech', 'm-rel')
    expect(section.textContent).toContain('No pilot')
    expect(section.textContent).toContain('No crawler')
    const drone = must(mech.partners?.[0])
    expect(
      within(section)
        .getByRole('link', { name: /Sestra Drone/ })
        .getAttribute('href')
    ).toBe(`/mechs/m-rel/companions/${drone.id}`)
  })

  test('a crawler with no crew draws its bay and crew places, to fill for its writer', () => {
    const section = readSheet('crawler', 'c-rel')
    expect(section.textContent).toContain('Dock a Mech')
    expect(section.textContent).toContain('Add a Pilot to the crew')
    expect(within(section).getAllByRole('link', { name: /Create/ })).toHaveLength(2)
  })

  test('a sheet the viewer cannot write names each empty place plainly', () => {
    const section = readSheet('crawler', 'c-rel', true)
    expect(section.textContent).toContain('No mech')
    expect(section.textContent).toContain('No pilot')
    expect(within(section).queryByRole('link', { name: /Create/ })).toBeNull()
  })
})
