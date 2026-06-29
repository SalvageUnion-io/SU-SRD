/**
 * Integration tests for CrawlerBuilder (create + edit on the WizShell
 * skeleton).
 *
 * Exercises Crawler (master-detail TYPE pick with feature preview) →
 * Systems (TL-filtered Sel grid) → Crew (NPC details) → Identity (name +
 * starting resources) → Review → submit using the real wizard, real
 * SalvageUnionReference data, real Zod validation, and a fake-indexeddb-backed
 * entityStore.
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
import { isWeaponSystem } from '../../../lib/rules/crawlerSystems'

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

/**
 * First WEAPONS (damage-dealing) system at a tech level. The crawler subtitle
 * counts only weapons systems toward the Armament-Bay cap, so count assertions
 * must install a weapon, not just any system.
 */
function weaponSystemAtTL(tl: number): { id: string; name: string } {
  const found = SalvageUnionReference.Systems.findAll(
    (s) => typeof s.techLevel === 'number' && s.techLevel === tl && isWeaponSystem(s)
  )[0]
  if (!found) throw new Error(`No weapons system at TL ${tl} in reference data`)
  return found as { id: string; name: string }
}

/** All WEAPONS systems at or below a tech level (the Systems-step catalog). */
function weaponSystemsUpToTL(tl: number): Array<{ id: string; name: string }> {
  return SalvageUnionReference.Systems.findAll(
    (s) => typeof s.techLevel === 'number' && s.techLevel <= tl && isWeaponSystem(s)
  ) as Array<{ id: string; name: string }>
}

/** First NON-weapon system at a tech level — must NOT appear in the catalog. */
function nonWeaponSystemAtTL(tl: number): { id: string; name: string } {
  const found = SalvageUnionReference.Systems.findAll(
    (s) => typeof s.techLevel === 'number' && s.techLevel === tl && !isWeaponSystem(s)
  )[0]
  if (!found) throw new Error(`No non-weapon system at TL ${tl} in reference data`)
  return found as { id: string; name: string }
}

// ---------------------------------------------------------------------------
// Create mode
// ---------------------------------------------------------------------------

describe('CrawlerBuilder — create mode', () => {
  it('renders the master-detail Crawler step with TYPE rows and a feature preview', async () => {
    render(<CrawlerBuilder onComplete={() => {}} onCancel={() => {}} />)

    expect(screen.getByText('Choose Your Crawler')).toBeTruthy()
    await waitFor(() => {
      expect(getPickByName('Battle')).toBeTruthy()
    })

    // No selection yet — Next is disabled, detail pane shows the empty hint.
    expect(getNextButton().disabled).toBe(true)
    expect(screen.getByText(/Select a crawler type to preview/i)).toBeTruthy()

    // Selecting a type shows its feature card (special action + NPC), NOT a bay grid.
    await pick('Battle')
    await waitFor(() => {
      // The special action is unique to the detail card.
      expect(screen.getByText('Improved Armour and Armaments')).toBeTruthy()
      // The special NPC's position surfaces (also in the OptRow desc → multiple).
      expect(screen.getAllByText('Grizzled Veteran').length).toBeGreaterThan(0)
    })
    expect(getNextButton().disabled).toBe(false)
  }, 30000)

  it('TL-filters the Systems step to Tech Level 1 (fixed for new crawlers)', async () => {
    render(<CrawlerBuilder onComplete={() => {}} onCancel={() => {}} />)

    await waitFor(() => getPickByName('Battle'))
    await pick('Battle')
    await clickNext()

    // The catalog is weapons-only, so isolate the TL behaviour with weapons.
    const tl1 = weaponSystemAtTL(1)
    const tl2 = weaponSystemAtTL(2)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: tl1.name })).toBeTruthy()
    })
    expect(screen.queryByRole('button', { name: tl2.name })).toBeNull()
  }, 30000)

  it('lists only WEAPONS systems — non-weapon systems never appear', async () => {
    render(<CrawlerBuilder onComplete={() => {}} onCancel={() => {}} />)

    await waitFor(() => getPickByName('Battle'))
    await pick('Battle')
    await clickNext() // -> Systems

    const weapon = weaponSystemAtTL(1)
    const nonWeapon = nonWeaponSystemAtTL(1)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: weapon.name })).toBeTruthy()
    })
    // A non-weapon system at the same TL is filtered out of the catalog.
    expect(screen.queryByRole('button', { name: nonWeapon.name })).toBeNull()
  }, 30000)

  it('hard-caps installs at the crawler-type allowance (Engineering = 1)', async () => {
    render(<CrawlerBuilder onComplete={() => {}} onCancel={() => {}} />)

    // Engineering is a non-Battle type: one Weapons System (Core Book p. 213).
    await waitFor(() => getPickByName('Engineering'))
    await pick('Engineering')
    await clickNext() // -> Systems

    const weapons = weaponSystemsUpToTL(1)
    expect(weapons.length).toBeGreaterThanOrEqual(2)
    const [first, second] = weapons

    // Both weapons are selectable before anything is installed.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: first!.name })).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: second!.name })).toBeTruthy()

    // Install one — the count hits the cap and the other cards disable
    // (a disabled card drops its role=button, so it is no longer pickable).
    await pick(first!.name)
    expect(screen.getByTestId('weapon-system-count').textContent).toContain('1 / 1')
    expect(screen.queryByRole('button', { name: second!.name })).toBeNull()
    // The installed card stays interactive so it can be swapped out.
    expect(screen.getByRole('button', { name: first!.name })).toBeTruthy()

    // Removing it frees the slot — the other weapon becomes selectable again.
    await pick(first!.name)
    expect(screen.getByTestId('weapon-system-count').textContent).toContain('0 / 1')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: second!.name })).toBeTruthy()
    })
  }, 30000)

  it('walks through every step and creates a TL1 typed crawler with seeded bays, crew + resources', async () => {
    const onComplete = mock(() => {})
    render(<CrawlerBuilder onComplete={onComplete} onCancel={() => {}} />)

    const battle = SalvageUnionReference.Crawlers.find((c) => c.name === 'Battle')!
    const commandBay = SalvageUnionReference.CrawlerBays.find((b) => b.name === 'Command Bay')!

    // --- Step 1: Crawler — pick a TYPE ---
    await waitFor(() => getPickByName('Battle'))
    await pick('Battle')
    await clickNext()

    // --- Step 2: Systems — live weapon-system count in subtitle ---
    const tl1 = weaponSystemAtTL(1)
    await pick(tl1.name)
    expect(screen.getByTestId('weapon-system-count').textContent).toContain('1 /')
    await clickNext()

    // --- Step 3: Crew — fill the Command Bay lead + the type NPC ---
    const byId = (id: string): HTMLElement => {
      const el = document.getElementById(id)
      if (!el) throw new Error(`No element #${id}`)
      return el
    }
    await waitFor(() => byId(`crew-${commandBay.id}-name`))
    fireEvent.change(byId(`crew-${commandBay.id}-name`), {
      target: { value: 'Maddox' },
    })
    fireEvent.change(byId(`crew-${commandBay.id}-keepsake`), {
      target: { value: 'A medal' },
    })
    fireEvent.change(byId(`crew-${battle.id}-name`), {
      target: { value: 'Vex' },
    })
    fireEvent.change(byId(`crew-${battle.id}-motto`), {
      target: { value: 'No retreat' },
    })
    await clickNext()

    // --- Step 4: Identity — name + starting resources ---
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

    // --- Step 5: Review → submit ('Create Crawler ✦') ---
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
      expect(c.type).toBe(battle.id)
      expect(c.schemaVersion).toBe(1)
      expect(c.systems).toEqual([tl1.id])
      expect(c.scrapPool).toEqual({ tl2: 3 })
      expect(c.upgradePool).toBe(12)

      // Full SRD bay set seeded, NPCs at max HP (4) where the bay has one.
      const srdBays = SalvageUnionReference.CrawlerBays.all()
      expect(c.crawlerBays?.length).toBe(srdBays.length)
      const seeded = c.crawlerBays?.find((e) => e.bayRef === commandBay.id)
      expect(seeded?.npcCurrentHP).toBe(4)
      expect(seeded?.npcName).toBe('Maddox')

      // Crew Keepsake routed to bayChoices; type NPC persisted to typeNpc.
      const keepsakeId = commandBay.npc!.choices!.find((ch) => ch.name === 'Keepsake')!.id
      expect(c.bayChoices?.[commandBay.id]?.[keepsakeId]).toEqual(['A medal'])
      expect(c.typeNpc?.npcName).toBe('Vex')
      const mottoId = battle.npc!.choices!.find((ch) => ch.name === 'Motto')!.id
      expect(c.bayChoices?.[battle.id]?.[mottoId]).toEqual(['No retreat'])

      // Fresh crawlers start at full SP for Tech Level 1.
      const tl = SalvageUnionReference.CrawlerTechLevels.find((t) => t.techLevel === 1)!
      expect(c.currentSP).toBe(tl.structurePoints)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  }, 30000)

  it('name gate: cannot reach Create with an empty name', async () => {
    render(<CrawlerBuilder onComplete={() => {}} onCancel={() => {}} />)

    await waitFor(() => getPickByName('Battle'))
    await pick('Battle')
    await clickNext() // Systems
    await clickNext() // Crew
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

  it('offers no bay catalog in the Crawler step — bays are seeded, not chosen', async () => {
    render(<CrawlerBuilder onComplete={() => {}} onCancel={() => {}} />)

    await waitFor(() => getPickByName('Battle'))
    await pick('Battle')

    // The type detail card shows features, not a 2-col bay head grid.
    expect(screen.queryByLabelText('Bay entity slug')).toBeNull()
    expect(screen.queryByRole('button', { name: /Add Bay/i })).toBeNull()
  }, 30000)
})

// ---------------------------------------------------------------------------
// Edit mode: upsert branch — live-play state never clobbered
// ---------------------------------------------------------------------------

async function seedCrawler(overrides?: { techLevel?: number; type?: string }) {
  const input = crawlerFormToCreateInput(
    {
      name: 'The Wandering Kettle',
      techLevel: overrides?.techLevel ?? 1,
      type: overrides?.type ?? null,
      systems: [],
      crew: {},
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

    // Add a weapons system in edit mode (the catalog is weapons-only).
    const tl1 = weaponSystemAtTL(1)
    await waitFor(() => screen.getByRole('button', { name: tl1.name }))
    await pick(tl1.name)
    await clickNext() // Crew (all optional)
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

  it('preserves a higher stored tech level on save (only create fixes TL1)', async () => {
    // A pre-feature crawler at Tech 3 with no chosen type.
    const crawler = await seedCrawler({ techLevel: 3 })
    expect(crawler.techLevel).toBe('tech-3')
    const played = useEntityStore.getState().get('crawler', crawler.id)!

    render(
      <CrawlerBuilder
        crawlerId={crawler.id}
        initialState={crawlerToFormState(played)}
        onComplete={() => {}}
        onCancel={() => {}}
      />
    )

    // Type-unselected (legacy crawler), but TL is preserved so Next gates on name.
    await waitFor(() => {
      expect(getNextButton().disabled).toBe(false)
    })
    await clickNext() // Systems
    await clickNext() // Crew
    await clickNext() // Identity
    await clickNext() // Review

    const save = screen.getByRole('button', { name: /Save Crawler/i })
    await act(async () => {
      fireEvent.click(save)
    })

    await waitFor(() => {
      const c = useEntityStore.getState().get('crawler', crawler.id)!
      expect(c.techLevel).toBe('tech-3')
    })
  }, 30000)

  it('changing the crawler TYPE on edit drops the old type NPC + bayChoices (no phantom bay)', async () => {
    const battle = SalvageUnionReference.Crawlers.find((c) => c.name === 'Battle')!
    const engineering = SalvageUnionReference.Crawlers.find((c) => c.name === 'Engineering')!

    // Seed a Battle crawler with a named Grizzled Veteran (type NPC) and a
    // Keepsake persisted in bayChoices keyed by the Battle type id.
    const input = crawlerFormToCreateInput(
      {
        name: 'War Wagon',
        techLevel: 1,
        type: battle.id,
        systems: [],
        crew: { [battle.id]: { name: 'Old Vex', keepsake: 'A dog tag' } },
        scrapPool: { ...EMPTY_SCRAP_POOL },
        upgradePool: 0,
      },
      { maxSP: 20, crawlerBays: seedDefaultCrawlerBays() }
    )
    const crawler = await useEntityStore.getState().create('crawler', input)
    expect(crawler.typeNpc?.npcName).toBe('Old Vex')
    expect(crawler.bayChoices?.[battle.id]).toBeTruthy()

    // Wound a real bay's NPC so we can prove live HP is preserved on save.
    const playedBayRef = crawler.crawlerBays![0]!.bayRef
    await useEntityStore.getState().updateCrawlerBay(crawler.id, playedBayRef, { npcCurrentHP: 1 })

    const played = useEntityStore.getState().get('crawler', crawler.id)!
    render(
      <CrawlerBuilder
        crawlerId={crawler.id}
        initialState={crawlerToFormState(played)}
        onComplete={() => {}}
        onCancel={() => {}}
      />
    )

    // Switch the type: Battle → Engineering on the Crawler step.
    await waitFor(() => getPickByName('Engineering'))
    await pick('Engineering')
    await clickNext() // Systems
    await clickNext() // Crew
    await clickNext() // Identity
    await clickNext() // Review

    const save = screen.getByRole('button', { name: /Save Crawler/i })
    await act(async () => {
      fireEvent.click(save)
    })

    await waitFor(() => {
      const c = useEntityStore.getState().get('crawler', crawler.id)!
      expect(c.type).toBe(engineering.id)

      // No phantom bay keyed by a type id (neither old nor new type).
      const srdBayIds = new Set(SalvageUnionReference.CrawlerBays.all().map((b) => b.id))
      for (const entry of c.crawlerBays ?? []) {
        expect(srdBayIds.has(entry.bayRef)).toBe(true)
      }
      expect(c.crawlerBays?.some((e) => e.bayRef === battle.id)).toBe(false)
      expect(c.crawlerBays?.some((e) => e.bayRef === engineering.id)).toBe(false)

      // The old type's NPC name does NOT carry over to the new type.
      expect(c.typeNpc?.npcName).not.toBe('Old Vex')

      // The orphaned old-type bayChoices key is cleared.
      expect(c.bayChoices?.[battle.id]).toBeUndefined()

      // Live bay HP is preserved through the type switch.
      const bay = c.crawlerBays?.find((e) => e.bayRef === playedBayRef)
      expect(bay?.npcCurrentHP).toBe(1)
    })
  }, 30000)

  it('a legacy crawler carrying a non-weapon system does not lock the weapons picker', async () => {
    // Regression: the Armament-Bay cap counts WEAPONS only. A legacy crawler
    // that carries a non-weapon system (Cargo Pod, Armour Plating, …) — which
    // the old wizard allowed and which never appears in the weapons-only
    // catalog — must NOT count toward the cap. Counting all selected slugs
    // would lock the picker (can't add the allowed weapon, can't remove the
    // stranded system → permanent dead-end).
    const nonWeapon = nonWeaponSystemAtTL(1)
    const input = crawlerFormToCreateInput(
      {
        name: 'Old Hauler',
        techLevel: 1,
        type: null,
        systems: [nonWeapon.id],
        crew: {},
        scrapPool: { ...EMPTY_SCRAP_POOL },
        upgradePool: 0,
      },
      { maxSP: 20, crawlerBays: seedDefaultCrawlerBays() }
    )
    const crawler = await useEntityStore.getState().create('crawler', input)
    const played = useEntityStore.getState().get('crawler', crawler.id)!

    render(
      <CrawlerBuilder
        crawlerId={crawler.id}
        initialState={crawlerToFormState(played)}
        onComplete={() => {}}
        onCancel={() => {}}
      />
    )

    await waitFor(() => {
      expect(getNextButton().disabled).toBe(false)
    })
    await clickNext() // -> Systems

    // The stranded non-weapon system does NOT count toward the weapons cap.
    const weapon = weaponSystemAtTL(1)
    await waitFor(() => {
      expect(screen.getByTestId('weapon-system-count').textContent).toContain('0 / 1')
    })
    // The allowed weapon is still selectable — the picker is not locked.
    const weaponBtn = screen.getByRole('button', { name: weapon.name })
    expect(weaponBtn).toBeTruthy()

    // Installing it ticks the weapon count to the cap; the non-weapon system
    // is preserved alongside it on save (never silently dropped).
    await pick(weapon.name)
    expect(screen.getByTestId('weapon-system-count').textContent).toContain('1 / 1')

    await clickNext() // Crew
    await clickNext() // Identity
    await clickNext() // Review
    const save = screen.getByRole('button', { name: /Save Crawler/i })
    await act(async () => {
      fireEvent.click(save)
    })
    await waitFor(() => {
      const c = useEntityStore.getState().get('crawler', crawler.id)!
      expect(c.systems).toContain(nonWeapon.id)
      expect(c.systems).toContain(weapon.id)
    })
  }, 30000)
})
