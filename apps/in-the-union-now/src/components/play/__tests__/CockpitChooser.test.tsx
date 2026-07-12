/**
 * CockpitChooser tests (Play Cockpit Phase 8, plan §8).
 *
 * fake-indexeddb/auto is preloaded via bunfig.toml; the real entityStore is
 * exercised so link-writes go through the true write-through path. The ORM is
 * preloaded in beforeAll because the mech step resolves chassis metadata.
 *
 * Uses .toBeTruthy() (no jest-dom type augmentation) per the ITUN convention.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { _clearAllStores, _resetDbSingleton } from '../../../lib/db/index'
import { useEntityStore } from '../../../stores/entityStore'
import { CockpitChooser } from '../CockpitChooser'
import { ensureCockpitLinks } from '../cockpitLinks'

const basePilotInput = {
  schemaVersion: 1 as const,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: [],
  equipment: [],
  motto: '',
  keepsake: '',
  appearance: '',
  background: '',
  conditions: [],
}

const baseMechInput = {
  schemaVersion: 1 as const,
  name: 'Iron Jaw',
  chassisRef: 'titan',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
}

const baseCrawlerInput = {
  schemaVersion: 1 as const,
  name: 'Tenacity',
  techLevel: '3',
  systems: [],
}

function resetEntityStore(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
}

async function settle(done: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !done(); i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
  }
}

/** Seed one crew (pilot + mech + crawler) into the hydrated store. */
async function seedCrew() {
  const store = useEntityStore.getState()
  await Promise.all([
    store.hydrate('pilot'),
    store.hydrate('mech'),
    store.hydrate('crawler'),
    store.hydrate('softLink'),
  ])
  const pilot = await store.create('pilot', basePilotInput)
  const mech = await store.create('mech', baseMechInput)
  const crawler = await store.create('crawler', baseCrawlerInput)
  return { pilot, mech, crawler }
}

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  resetEntityStore()
})

afterEach(async () => {
  await _clearAllStores()
  act(() => {
    resetEntityStore()
  })
})

describe('ensureCockpitLinks', () => {
  test('creates the mech-to-pilot and pilot-to-crawler links', async () => {
    const { pilot, mech, crawler } = await seedCrew()
    const store = useEntityStore.getState()

    await ensureCockpitLinks({
      store,
      links: store.softLinks,
      pilotId: pilot.id,
      mechId: mech.id,
      crawlerId: crawler.id,
    })

    const links = useEntityStore.getState().softLinks
    const mechLink = links.find((l) => l.type === 'mech-to-pilot')
    const crawlerLink = links.find((l) => l.type === 'pilot-to-crawler')
    expect(mechLink?.from.id).toBe(mech.id)
    expect(mechLink?.to.id).toBe(pilot.id)
    expect(crawlerLink?.from.id).toBe(pilot.id)
    expect(crawlerLink?.to.id).toBe(crawler.id)
  })

  test('does not create a crawler link when no crawler is chosen', async () => {
    const { pilot, mech } = await seedCrew()
    const store = useEntityStore.getState()

    await ensureCockpitLinks({ store, links: store.softLinks, pilotId: pilot.id, mechId: mech.id })

    const links = useEntityStore.getState().softLinks
    expect(links.filter((l) => l.type === 'mech-to-pilot').length).toBe(1)
    expect(links.filter((l) => l.type === 'pilot-to-crawler').length).toBe(0)
  })

  test('repairs a conflicting mech-to-pilot link rather than duplicating', async () => {
    const { pilot, mech } = await seedCrew()
    const store = useEntityStore.getState()
    // Pre-existing link from the same mech pointing at a stale pilot.
    await store.create('softLink', {
      from: { type: 'mech', id: mech.id },
      to: { type: 'pilot', id: 'stale-pilot' },
      type: 'mech-to-pilot',
    })

    await ensureCockpitLinks({
      store,
      links: useEntityStore.getState().softLinks,
      pilotId: pilot.id,
      mechId: mech.id,
    })

    const mechLinks = useEntityStore
      .getState()
      .softLinks.filter((l) => l.type === 'mech-to-pilot' && l.from.id === mech.id)
    expect(mechLinks.length).toBe(1)
    expect(mechLinks[0]?.to.id).toBe(pilot.id)
  })
})

describe('CockpitChooser — wizard', () => {
  test('lists pilots then mechs across the wizard steps', async () => {
    await seedCrew()
    resetEntityStore()

    await act(async () => {
      render(<CockpitChooser />)
    })

    // Open the chooser.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Launch the Dashboard' }))
    })
    await settle(() => screen.queryByRole('radio', { name: /Yara Voss/ }) !== null)
    expect(screen.getByRole('radio', { name: /Yara Voss/ })).toBeTruthy()

    // Pick the pilot, advance to the mech step.
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: /Yara Voss/ }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    })
    expect(screen.getByRole('radio', { name: /Iron Jaw/ })).toBeTruthy()
  })

  test('launching calls onLaunch with the chosen mech and links the crew', async () => {
    const { pilot, mech, crawler } = await seedCrew()
    resetEntityStore()

    const result: { id: string | null } = { id: null }
    await act(async () => {
      render(
        <CockpitChooser
          onLaunch={(id) => {
            result.id = id
          }}
        />
      )
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Launch the Dashboard' }))
    })
    await settle(() => screen.queryByRole('radio', { name: /Yara Voss/ }) !== null)

    // Pilot → Next
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: /Yara Voss/ }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    })
    // Mech → Next
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: /Iron Jaw/ }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    })
    // Crawler → Launch
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: /Tenacity/ }))
    })
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Launch the Dashboard for the chosen crew' })
      )
    })
    await settle(() => result.id !== null)

    expect(result.id).toBe(mech.id)
    const links = useEntityStore.getState().softLinks
    expect(
      links.some((l) => l.type === 'mech-to-pilot' && l.from.id === mech.id && l.to.id === pilot.id)
    ).toBe(true)
    expect(
      links.some(
        (l) => l.type === 'pilot-to-crawler' && l.from.id === pilot.id && l.to.id === crawler.id
      )
    ).toBe(true)
  })
})
