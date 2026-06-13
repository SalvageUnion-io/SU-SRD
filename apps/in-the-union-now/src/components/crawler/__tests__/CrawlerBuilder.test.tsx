/**
 * Integration tests for CrawlerBuilder (create + edit on the WizShell
 * skeleton).
 *
 * Exercises Crawler (master-detail tech-level pick with bay preview) →
 * Systems (TL-filtered Sel grid) → Identity (name + starting resources) →
 * Review → submit using the real wizard, real SalvageUnionReference data,
 * real Zod validation, and a fake-indexeddb-backed entityStore.
 *
 * fake-indexeddb/auto is preloaded via bunfig.toml.
 * SalvageUnionReference is preloaded in beforeAll.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { useEntityStore } from '../../../stores/entityStore'
import { _clearAllStores, _resetDbSingleton } from '../../../lib/db/index'
import {
  EMPTY_SCRAP_POOL,
  crawlerFormToCreateInput,
  crawlerToFormState,
  seedDefaultCrawlerBays,
} from '../../../lib/wizard/crawlerFormState'
import { CrawlerBuilder } from '../CrawlerBuilder'

// ---------------------------------------------------------------------------
// Pre-load reference data
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

// ---------------------------------------------------------------------------
// Store reset helpers
// ---------------------------------------------------------------------------

function resetEntityStore(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: {
      pilots: false,
      mechs: false,
      crawlers: false,
      softLinks: false,
    },
  })
}

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  resetEntityStore()
  await useEntityStore.getState().hydrate('crawler')
})

afterEach(async () => {
  await act(async () => {
    cleanup()
  })
  await _clearAllStores()
  resetEntityStore()
})

// ---------------------------------------------------------------------------
// Helpers (WizShell skeleton)
// ---------------------------------------------------------------------------

/**
 * Tech-level rows are OptRow <button>s whose accessible text starts with the
 * level name; system cards are Sel wrappers — div[role="button"] with
 * aria-label set to the entity name. Both report role=button.
 */
function getPickByName(name: string): HTMLElement {
  const candidates = screen.getAllByRole('button')
  const exact = candidates.find((b) => b.getAttribute('aria-label') === name)
  if (exact) return exact
  const row = candidates.find((b) => (b.textContent ?? '').includes(name))
  if (!row) throw new Error(`No role=button pick for "${name}"`)
  return row
}

async function pick(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(getPickByName(name))
  })
}

/** The primary CTA is labeled from the steps array: 'Next · {step} →'. */
function getNextButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /^Next ·/ }) as HTMLButtonElement
}

async function clickNext(): Promise<void> {
  await act(async () => {
    fireEvent.click(getNextButton())
  })
}

/** First system at exactly this TL from the real catalog. */
function systemAtTL(tl: number): { id: string; name: string } {
  const found = SalvageUnionReference.Systems.findAll(
    (s) => typeof s.techLevel === 'number' && s.techLevel === tl
  )[0]
  if (!found) throw new Error(`No system at TL ${tl} in reference data`)
  return found as { id: string; name: string }
}

// ---------------------------------------------------------------------------
// Create mode
// ---------------------------------------------------------------------------

describe('CrawlerBuilder — create mode', () => {
  it('renders the master-detail Crawler step with tech-level rows and bay preview', async () => {
    render(<CrawlerBuilder onComplete={() => {}} onCancel={() => {}} />)

    expect(screen.getByText('Choose Your Crawler')).toBeTruthy()
    await waitFor(() => {
      expect(getPickByName('Hamlet Crawler')).toBeTruthy()
    })

    // No selection yet — Next is disabled, detail pane shows the empty hint.
    expect(getNextButton().disabled).toBe(true)
    expect(screen.getByText(/Select a crawler tech level/i)).toBeTruthy()

    // Selecting a level expands its detail card with the 2-col bay head grid.
    await pick('Village Crawler')
    await waitFor(() => {
      expect(screen.getByText('Command Bay')).toBeTruthy()
      expect(screen.getByText('Mech Bay')).toBeTruthy()
    })
    expect(getNextButton().disabled).toBe(false)
  }, 30000)

  it('TL-filters the Systems step to the crawler tech level and below', async () => {
    render(<CrawlerBuilder onComplete={() => {}} onCancel={() => {}} />)

    await waitFor(() => getPickByName('Hamlet Crawler'))
    await pick('Hamlet Crawler')
    await clickNext()

    const tl1 = systemAtTL(1)
    const tl2 = systemAtTL(2)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: tl1.name })).toBeTruthy()
    })
    expect(screen.queryByRole('button', { name: tl2.name })).toBeNull()
  }, 30000)

  it('walks through every step and creates a valid crawler with seeded bays + resources', async () => {
    const onComplete = mock(() => {})
    render(<CrawlerBuilder onComplete={onComplete} onCancel={() => {}} />)

    // --- Step 1: Crawler (master-detail OptRow list) ---
    await waitFor(() => getPickByName('Hamlet Crawler'))
    await pick('Hamlet Crawler')
    await clickNext()

    // --- Step 2: Systems — live count in subtitle ---
    const tl1 = systemAtTL(1)
    await pick(tl1.name)
    expect(screen.getByTestId('system-count').textContent).toContain('1 /')
    await clickNext()

    // --- Step 3: Identity — name + starting resources ---
    fireEvent.change(screen.getByLabelText(/Crawler Name/i), {
      target: { value: 'Bay Wagon' },
    })
    fireEvent.change(screen.getByLabelText(/Scrap T2/i), {
      target: { value: '3' },
    })
    fireEvent.change(screen.getByLabelText(/Upgrade Pool/i), {
      target: { value: '12' },
    })
    await clickNext()

    // --- Step 4: Review → submit ('Create Crawler ✦') ---
    expect(screen.getByText(/seeded automatically/i)).toBeTruthy()
    const submit = screen.getByRole('button', { name: /Create Crawler/i })
    await act(async () => {
      fireEvent.click(submit)
    })

    await waitFor(() => {
      const crawlers = useEntityStore.getState().list('crawler')
      expect(crawlers.length).toBe(1)
      const c = crawlers[0]!
      expect(c.name).toBe('Bay Wagon')
      expect(c.techLevel).toBe('tech-1')
      expect(c.schemaVersion).toBe(1)
      expect(c.systems).toEqual([tl1.id])
      expect(c.scrapPool).toEqual({ tl2: 3 })
      expect(c.upgradePool).toBe(12)

      // Full SRD bay set seeded, NPCs at max HP (4) where the bay has one.
      const srdBays = SalvageUnionReference.CrawlerBays.all()
      expect(c.crawlerBays?.length).toBe(srdBays.length)
      const commandBay = srdBays.find((b) => b.name === 'Command Bay')!
      const seeded = c.crawlerBays?.find((e) => e.bayRef === commandBay.id)
      expect(seeded?.npcCurrentHP).toBe(4)

      // Fresh crawlers start at full SP for their tech level.
      const tl = SalvageUnionReference.CrawlerTechLevels.find((t) => t.techLevel === 1)!
      expect(c.currentSP).toBe(tl.structurePoints)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  }, 30000)

  it('name gate: cannot reach Create with an empty name', async () => {
    render(<CrawlerBuilder onComplete={() => {}} onCancel={() => {}} />)

    await waitFor(() => getPickByName('Hamlet Crawler'))
    await pick('Hamlet Crawler')
    await clickNext() // Systems
    await clickNext() // Identity

    // Name left empty — Next stays disabled, Review/Create is unreachable.
    expect(getNextButton().disabled).toBe(true)
    expect(useEntityStore.getState().list('crawler').length).toBe(0)
  }, 30000)

  it('cancel calls onCancel', async () => {
    const onCancel = mock(() => {})
    render(<CrawlerBuilder onComplete={() => {}} onCancel={onCancel} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('offers no bay catalog or free-text crew editor — bays are seeded, not chosen', async () => {
    render(<CrawlerBuilder onComplete={() => {}} onCancel={() => {}} />)

    await waitFor(() => getPickByName('Hamlet Crawler'))
    await pick('Hamlet Crawler')
    await clickNext()

    expect(screen.queryByLabelText('Bay entity slug')).toBeNull()
    expect(screen.queryByRole('button', { name: /Add Bay/i })).toBeNull()
  }, 30000)
})

// ---------------------------------------------------------------------------
// Edit mode: upsert branch — live-play state never clobbered
// ---------------------------------------------------------------------------

async function seedCrawler() {
  const input = crawlerFormToCreateInput(
    {
      name: 'The Wandering Kettle',
      techLevel: 1,
      systems: [],
      scrapPool: { ...EMPTY_SCRAP_POOL },
      upgradePool: 0,
    },
    { maxSP: 20, crawlerBays: seedDefaultCrawlerBays() }
  )
  return useEntityStore.getState().create('crawler', input)
}

describe('CrawlerBuilder — edit mode', () => {
  it('prefills from the crawler and updates without duplicating or touching live state', async () => {
    const crawler = await seedCrawler()
    // Simulate play: SP knocked down + a bay NPC wounded.
    const playedBayRef = crawler.crawlerBays![0]!.bayRef
    await useEntityStore.getState().update('crawler', crawler.id, { currentSP: 5 })
    await useEntityStore.getState().updateCrawlerBay(crawler.id, playedBayRef, {
      npcCurrentHP: 1,
      condition: 'damaged',
    })

    const played = useEntityStore.getState().get('crawler', crawler.id)!
    const onComplete = mock(() => {})
    render(
      <CrawlerBuilder
        crawlerId={crawler.id}
        initialState={crawlerToFormState(played)}
        onComplete={onComplete}
        onCancel={() => {}}
      />
    )

    // Eyebrow flips to edit mode; TL is prefilled so Next is enabled.
    expect(screen.getByText('Edit Crawler')).toBeTruthy()
    await waitFor(() => {
      expect(getNextButton().disabled).toBe(false)
    })
    await clickNext() // Systems

    // Add a system in edit mode.
    const tl1 = systemAtTL(1)
    await waitFor(() => screen.getByRole('button', { name: tl1.name }))
    await pick(tl1.name)
    await clickNext() // Identity (name prefilled)
    await clickNext() // Review

    // Review → 'Save Crawler' (never 'Create')
    const save = screen.getByRole('button', { name: /Save Crawler/i })
    await act(async () => {
      fireEvent.click(save)
    })

    await waitFor(() => {
      const crawlers = useEntityStore.getState().list('crawler')
      // Upsert branch: same record updated — never a duplicate create.
      expect(crawlers.length).toBe(1)
      const c = crawlers[0]!
      expect(c.id).toBe(crawler.id)
      expect(c.name).toBe('The Wandering Kettle')
      expect(c.systems).toEqual([tl1.id])
      // Live-play state untouched by the wizard patch.
      expect(c.currentSP).toBe(5)
      const bay = c.crawlerBays?.find((e) => e.bayRef === playedBayRef)
      expect(bay?.npcCurrentHP).toBe(1)
      expect(bay?.condition).toBe('damaged')
      expect(c.crawlerBays?.length).toBe(crawler.crawlerBays!.length)
    })
    expect(onComplete).toHaveBeenCalledWith(crawler.id)
  }, 30000)
})
