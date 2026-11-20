/**
 * CompanionSheet: a companion's own page, read through its host's `partners`.
 * A Little Sestra built the way the wizard builds one fields its Sestra Drone;
 * the page shows the drone's own band, vitals, abilities, loadout and hold,
 * and a missing host or companion says so with a way back.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { makeUnitLot } from 'game-domain/schemas/cargoLot'
import type { Mech } from 'game-domain/schemas/mech'
import type { ReactElement } from 'react'
import { mechFixture } from '../../../components/__tests__/fixtures'
import { must } from '../../../components/__tests__/must'
import { mechPartnerSeeds, syncPartners } from '../../../lib/rules/partnerGrants'

const { CompanionSheet } = await import('../CompanionSheet')
const { resetStores } = await import('../../../replica/__tests__/resetStores')
const { withSignedInBackend } = await import('../../../replica/__tests__/signedInBackend')
const { useUnits } = await import('../../../replica/units')

withSignedInBackend()

function sestra(overrides: Partial<Mech> = {}): Mech {
  const partners = must(
    syncPartners(undefined, mechPartnerSeeds('little-sestra', 'Surveyor'), { reseedLoadout: true })
  )
  return mechFixture({
    id: 'mech-companion-1',
    name: 'Custos',
    chassisRef: 'little-sestra',
    partners,
    ...overrides,
  })
}

async function show(ui: ReactElement) {
  await act(async () => {
    render(ui)
  })
}

async function seed(mech: Mech) {
  await act(async () => {
    await useUnits.getState().adopt('mech', mech)
  })
}

beforeEach(() => {
  resetStores()
})

afterEach(() => {
  // Unmount first: a reset under a mounted sheet is an update outside act().
  cleanup()
  resetStores()
})

describe('CompanionSheet', () => {
  test('a Sestra Drone gets its own page: band, host link, vitals and slot figures', async () => {
    const mech = sestra()
    await seed(mech)
    const drone = must(mech.partners?.[0])
    await show(<CompanionSheet hostKind="mech" hostId={mech.id} partnerId={drone.id} />)

    const main = must(document.querySelector('main.su-companion-sheet')) as HTMLElement
    expect(main.textContent).toContain('Companion of')
    const back = within(main).getByRole('link', { name: /Custos/ })
    expect(back.getAttribute('href')).toContain(`/mechs/${mech.id}`)
    expect(main.textContent).toMatch(/Drone/)
    // Its own vitals, not the Little Sestra's.
    expect(screen.getAllByText(/SP/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/EP/).length).toBeGreaterThan(0)
  })

  test('its loadout reads as Systems and Modules tables, its hold as Cargo', async () => {
    const mech = sestra()
    await seed(mech)
    const drone = must(mech.partners?.[0])
    await show(<CompanionSheet hostKind="mech" hostId={mech.id} partnerId={drone.id} />)

    expect(screen.getByRole('table', { name: /Systems/ })).toBeTruthy()
    expect(screen.getByRole('table', { name: /Modules/ })).toBeTruthy()
    expect(screen.getByRole('table', { name: /Cargo/ })).toBeTruthy()
    expect(screen.getAllByText(/Hover Locomotion System/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Survey Scanner/i).length).toBeGreaterThan(0)
    expect(screen.getByText('Nothing in the hold.')).toBeTruthy()
  })

  test('cargo lots and the companion’s own lines show when it has them', async () => {
    const base = sestra()
    const drone = must(base.partners?.[0])
    const mech = sestra({
      partners: [
        {
          ...drone,
          aiPersonality: 'Curious and chatty.',
          appearance: 'Dented orange shell.',
          cargoLots: [makeUnitLot('Salvaged Radio', { units: 2 })],
        },
      ],
    } as Partial<Mech>)
    await seed(mech)
    await show(<CompanionSheet hostKind="mech" hostId={mech.id} partnerId={drone.id} />)

    expect(screen.getByText('Curious and chatty.')).toBeTruthy()
    expect(screen.getByText('Dented orange shell.')).toBeTruthy()
    const cargo = screen.getByRole('table', { name: /Cargo/ })
    expect(within(cargo).getByText('Salvaged Radio')).toBeTruthy()
  })

  test('a companion the host does not have says so, with the way back', async () => {
    const mech = sestra()
    await seed(mech)
    await show(<CompanionSheet hostKind="mech" hostId={mech.id} partnerId="nobody" />)

    expect(screen.getByText(/No such companion/)).toBeTruthy()
    const back = screen.getByRole('link', { name: /Back to its mech/ })
    expect(back.getAttribute('href')).toContain(`/mechs/${mech.id}`)
  })

  test('a pilot host that is not in the replica says so too', async () => {
    await show(<CompanionSheet hostKind="pilot" hostId="missing" partnerId="nobody" />)
    expect(screen.getByRole('link', { name: /Back to its pilot/ })).toBeTruthy()
  })
})
