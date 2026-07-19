/**
 * Integration tests for CrawlerBuilder (create + edit on the WizShell
 * skeleton), restructured to the Union Crawler's book order (wizard-refresh
 * Phase 5, pp.212–213):
 *
 *   Choose a Crawler Type (radio entity cards) → Note your Crawler
 *   Statistics (display-only, create) → Arm the Armament Bay (Tech-1
 *   weapons, min 1, mutations-derived cap) → Name your Crew (roster rows →
 *   IdentityFields) → Name your Crawler (name + scrap pool) → Review →
 *   submit.
 *
 * Uses the real wizard, real SalvageUnionReference data, real Zod validation,
 * and a fake-indexeddb-backed entityStore (fake-indexeddb/auto preloaded via
 * bunfig.toml; SalvageUnionReference preloaded in beforeAll).
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
import { must } from '../../__tests__/must'

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
  sessionStorage.clear()
  _resetDbSingleton()
  await _clearAllStores()
  resetEntityStore()
  await useEntityStore.getState().hydrate('crawler')
})

afterEach(async () => {
  await act(async () => {
    cleanup()
  })
  sessionStorage.clear()
  await _clearAllStores()
  resetEntityStore()
})

// ---------------------------------------------------------------------------
// Helpers (WizShell skeleton)
// ---------------------------------------------------------------------------

/** Crawler-type cells are radio SelCards (exactly-one semantics). */
async function pickType(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('radio', { name }))
  })
}

/** Weapon cards are Sel wrappers — div[role="button"] with aria-label. */
function getPickByName(name: string): HTMLElement {
  const candidates = screen.getAllByRole('button')
  const exact = candidates.find((b) => b.getAttribute('aria-label') === name)
  if (!exact) throw new Error(`No role=button pick for "${name}"`)
  return exact
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

/** Expand a crew roster row by clicking its entity card (cardClick → button). */
async function expandRow(name: string): Promise<void> {
  const card = screen
    .getAllByRole('button')
    .find((b) => (b.textContent ?? '').includes(name) && b.getAttribute('aria-label') === null)
  if (!card) throw new Error(`No clickable roster card for "${name}"`)
  await act(async () => {
    fireEvent.click(card)
  })
}

/** Fill a click-to-edit IdentityField (open → type → blur commits). */
async function fillField(editLabel: string, value: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: editLabel }))
  })
  const input = screen.getByRole('textbox', { name: editLabel }) as HTMLInputElement
  await act(async () => {
    fireEvent.change(input, { target: { value } })
    fireEvent.blur(input, { target: { value } })
  })
}

/**
 * First WEAPONS (damage-dealing) system at a tech level. The Armament-Bay cap
 * counts only weapons systems, so count assertions must install a weapon.
 */
function weaponSystemAtTL(tl: number): { id: string; name: string } {
  const found = SalvageUnionReference.Systems.findAll(
    (s) => typeof s.techLevel === 'number' && s.techLevel === tl && isWeaponSystem(s)
  )[0]
  if (!found) throw new Error(`No weapons system at TL ${tl} in reference data`)
  return found as { id: string; name: string }
}

/** All WEAPONS systems at or below a tech level. */
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
  it('step 1 renders the five types as radio entity cards with a mutations badge + detail', async () => {
    render(<CrawlerBuilder onComplete={() => {}} onCancel={() => {}} />)

    expect(screen.getAllByText('Choose a Crawler Type').length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Battle' })).toBeTruthy()
    })
    for (const name of ['Augmented', 'Engineering', 'Exploratory', 'Trade Caravan']) {
      expect(screen.getByRole('radio', { name })).toBeTruthy()
    }

    // No selection yet — Next is gated with a reason.
    expect(getNextButton().disabled).toBe(true)
    expect(screen.getByText(/Choose your Crawler type/i)).toBeTruthy()

    // Selecting Battle shows its full detail card: the unique Ability + NPC.
    await pickType('Battle')
    await waitFor(() => {
      expect(screen.getAllByText('Improved Armour and Armaments').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Grizzled Veteran').length).toBeGreaterThan(0)
    })
    expect(getNextButton().disabled).toBe(false)
  }, 30000)

  it('the Augmented type surfaces the +1 Training Point callout (text only)', async () => {
    render(<CrawlerBuilder onComplete={() => {}} onCancel={() => {}} />)
    await waitFor(() => screen.getByRole('radio', { name: 'Augmented' }))
    await pickType('Augmented')
    await waitFor(() => {
      expect(screen.getByText(/\+1 Training Point/)).toBeTruthy()
      expect(screen.getByText(/Augment ability tree only/)).toBeTruthy()
    })
  }, 30000)

  it('step 2 displays fixed TL1 statistics with the derived SP breakdown (Battle 20 + 5 = 25)', async () => {
    render(<CrawlerBuilder onComplete={() => {}} onCancel={() => {}} />)
    await waitFor(() => screen.getByRole('radio', { name: 'Battle' }))
    await pickType('Battle')
    await clickNext() // -> Statistics

    const breakdown = screen.getByTestId('sp-breakdown')
    expect(breakdown.textContent).toContain('20 + 5 type bonus')
    expect(breakdown.textContent).toContain('25')
    // Display-only: no Tech Level input exists, Next is never gated here.
    expect(screen.queryByLabelText(/Tech Level/i)).toBeNull()
    expect(getNextButton().disabled).toBe(false)
  }, 30000)

  it('TL-filters the Armament step to Tech 1 weapons only (non-weapons excluded)', async () => {
    render(<CrawlerBuilder onComplete={() => {}} onCancel={() => {}} />)

    await waitFor(() => screen.getByRole('radio', { name: 'Battle' }))
    await pickType('Battle')
    await clickNext() // Statistics
    await clickNext() // -> Armament Bay

    const tl1 = weaponSystemAtTL(1)
    const tl2 = weaponSystemAtTL(2)
    const nonWeapon = nonWeaponSystemAtTL(1)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: tl1.name })).toBeTruthy()
    })
    // Higher-TL weapons are FILTERED OUT (never rendered), as are non-weapons.
    expect(screen.queryByRole('button', { name: tl2.name })).toBeNull()
    expect(screen.queryByRole('button', { name: nonWeapon.name })).toBeNull()
  }, 30000)

  it('gates the Armament step on the minimum-1 weapon mount', async () => {
    render(<CrawlerBuilder onComplete={() => {}} onCancel={() => {}} />)

    await waitFor(() => screen.getByRole('radio', { name: 'Engineering' }))
    await pickType('Engineering')
    await clickNext() // Statistics
    await clickNext() // -> Armament Bay

    // Nothing mounted — Next is locked with the reason in the footer.
    expect(getNextButton().disabled).toBe(true)
    expect(screen.getByText(/Mount at least one Weapons System/i)).toBeTruthy()

    const weapon = weaponSystemAtTL(1)
    await pick(weapon.name)
    expect(getNextButton().disabled).toBe(false)
  }, 30000)

  it('hard-caps installs at the mutations-derived type allowance (Engineering = 1)', async () => {
    render(<CrawlerBuilder onComplete={() => {}} onCancel={() => {}} />)

    await waitFor(() => screen.getByRole('radio', { name: 'Engineering' }))
    await pickType('Engineering')
    await clickNext() // Statistics
    await clickNext() // -> Armament Bay

    const weapons = weaponSystemsUpToTL(1)
    expect(weapons.length).toBeGreaterThanOrEqual(2)
    const [first, second] = weapons

    await waitFor(() => {
      expect(screen.getByRole('button', { name: must(first).name })).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: must(second).name })).toBeTruthy()

    // Install one — the count hits the cap and the other cards disable
    // (a disabled card drops its role=button, so it is no longer pickable).
    await pick(must(first).name)
    expect(screen.getByTestId('weapon-system-count').textContent).toContain('1 / 1')
    expect(screen.queryByRole('button', { name: must(second).name })).toBeNull()
    // The installed card stays interactive so it can be swapped out.
    expect(screen.getByRole('button', { name: must(first).name })).toBeTruthy()

    // Removing it frees the slot — the other weapon becomes selectable again.
    await pick(must(first).name)
    expect(screen.getByTestId('weapon-system-count').textContent).toContain('0 / 1')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: must(second).name })).toBeTruthy()
    })
  }, 30000)

  it('a Battle Crawler mounts two — and a type change re-clamps with a toast', async () => {
    render(<CrawlerBuilder onComplete={() => {}} onCancel={() => {}} />)

    await waitFor(() => screen.getByRole('radio', { name: 'Battle' }))
    await pickType('Battle')
    await clickNext() // Statistics
    await clickNext() // -> Armament Bay

    const weapons = weaponSystemsUpToTL(1)
    const [first, second] = weapons
    await waitFor(() => screen.getByRole('button', { name: must(first).name }))
    await pick(must(first).name)
    await pick(must(second).name)
    expect(screen.getByTestId('weapon-system-count').textContent).toContain('2 / 2')

    // Back to step 1: switching Battle → Engineering re-clamps to 1 slot,
    // dropping the NEWEST mount.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Crawler Type/i }))
    })
    await pickType('Engineering')
    await clickNext() // Statistics
    await clickNext() // -> Armament Bay
    expect(screen.getByTestId('weapon-system-count').textContent).toContain('1 / 1')
  }, 30000)

  it('walks every book step and creates a TL1 Battle crawler seeded at the DERIVED full SP', async () => {
    const onComplete = mock(() => {})
    render(<CrawlerBuilder onComplete={onComplete} onCancel={() => {}} />)

    const battle = must(SalvageUnionReference.Crawlers.find((c) => c.name === 'Battle'))
    const commandBay = must(SalvageUnionReference.CrawlerBays.find((b) => b.name === 'Command Bay'))

    // --- Step 1: Choose a Crawler Type ---
    await waitFor(() => screen.getByRole('radio', { name: 'Battle' }))
    await pickType('Battle')
    await clickNext()

    // --- Step 2: Note your Crawler Statistics (display-only) ---
    expect(screen.getByTestId('sp-breakdown')).toBeTruthy()
    await clickNext()

    // --- Step 3: Arm the Armament Bay (min 1, Tech 1 weapons) ---
    const tl1 = weaponSystemAtTL(1)
    await pick(tl1.name)
    expect(screen.getByTestId('weapon-system-count').textContent).toContain('1 /')
    await clickNext()

    // --- Step 4: Name your Crew (roster rows → IdentityFields) ---
    await expandRow('Battle')
    await fillField('Edit grizzled veteran name', 'Vex')
    await fillField('Edit grizzled veteran motto', 'No retreat')
    await expandRow('Command Bay')
    await fillField('Edit princeps name', 'Maddox')
    await fillField('Edit princeps keepsake', 'A medal')
    await clickNext()

    // --- Step 5: Name your Crawler (+ scrap pool; NO upgrade pool input) ---
    expect(screen.queryByLabelText(/Upgrade Pool/i)).toBeNull()
    await fillField('Edit crawler name', 'Bay Wagon')
    fireEvent.change(screen.getByLabelText(/Scrap T2/i), { target: { value: '3' } })
    await clickNext()

    // --- Review → submit ('Create Crawler ✦') ---
    const submit = screen.getByRole('button', { name: /Create Crawler/i })
    await act(async () => {
      fireEvent.click(submit)
    })

    await waitFor(() => {
      const crawlers = useEntityStore.getState().list('crawler')
      expect(crawlers.length).toBe(1)
      const c = must(crawlers[0])
      expect(c.name).toBe('Bay Wagon')
      expect(c.techLevel).toBe('tech-1')
      expect(c.type).toBe(battle.id)
      expect(c.schemaVersion).toBe(1)
      expect(c.systems).toEqual([tl1.id])
      expect(c.scrapPool).toEqual({ tl2: 3 })
      // upgradePool is FIXED at 0 at creation (input removed).
      expect(c.upgradePool).toBe(0)
      // The record stores NO SP maximum and NO type bonus — max SP derives at
      // read. currentSP seeds at the DERIVED full (20 base + 5 Battle) = 25.
      expect(c.maxSpModifier).toBeUndefined()
      expect(c.currentSP).toBe(25)

      // Base bay set seeded (expansion bays excluded), NPCs at max HP (4)
      // where the bay has one.
      const baseBays = SalvageUnionReference.CrawlerBays.all().filter((b) => !b.expansion)
      expect(c.crawlerBays?.length).toBe(baseBays.length)
      const expansionBays = SalvageUnionReference.CrawlerBays.all().filter((b) => b.expansion)
      expect(expansionBays.length).toBeGreaterThan(0)
      for (const exp of expansionBays) {
        expect(c.crawlerBays?.some((e) => e.bayRef === exp.id)).toBe(false)
      }
      const seeded = c.crawlerBays?.find((e) => e.bayRef === commandBay.id)
      expect(seeded?.npcCurrentHP).toBe(4)
      expect(seeded?.npcName).toBe('Maddox')

      // Crew Keepsake routed to bayChoices; type NPC persisted to typeNpc.
      const keepsakeId = must(
        must(must(commandBay.npc).choices).find((ch) => ch.name === 'Keepsake')
      ).id
      expect(c.bayChoices?.[commandBay.id]?.[keepsakeId]).toEqual(['A medal'])
      expect(c.typeNpc?.npcName).toBe('Vex')
      expect(c.typeNpc?.npcCurrentHP).toBe(10) // the Grizzled Veteran's fixed HP
      const mottoId = must(must(must(battle.npc).choices).find((ch) => ch.name === 'Motto')).id
      expect(c.bayChoices?.[battle.id]?.[mottoId]).toEqual(['No retreat'])
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  }, 30000)

  it('name gate: cannot reach Create with an empty name', async () => {
    render(<CrawlerBuilder onComplete={() => {}} onCancel={() => {}} />)

    await waitFor(() => screen.getByRole('radio', { name: 'Battle' }))
    await pickType('Battle')
    await clickNext() // Statistics
    await clickNext() // Armament Bay
    await pick(weaponSystemAtTL(1).name) // satisfy the min-1 mount
    await clickNext() // Crew
    await clickNext() // Name

    // Name left empty — Next stays disabled, Review/Create is unreachable.
    expect(getNextButton().disabled).toBe(true)
    expect(screen.getByText(/Name your Crawler to continue/i)).toBeTruthy()
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

  it('offers no bay catalog anywhere — bays are seeded, not chosen', async () => {
    render(<CrawlerBuilder onComplete={() => {}} onCancel={() => {}} />)

    await waitFor(() => screen.getByRole('radio', { name: 'Battle' }))
    await pickType('Battle')

    expect(screen.queryByLabelText('Bay entity slug')).toBeNull()
    expect(screen.queryByRole('button', { name: /Add Bay/i })).toBeNull()
  }, 30000)
})

// ---------------------------------------------------------------------------
// Edit mode: upsert branch — soft regime, live-play state never clobbered
// ---------------------------------------------------------------------------

async function seedCrawler(overrides?: { techLevel?: number; type?: string }) {
  const input = crawlerFormToCreateInput(
    {
      name: 'The Wandering Kettle',
      description: '',
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
  it('hides the Statistics step and prefills; updates without duplicating or touching live state', async () => {
    const crawler = await seedCrawler()
    // Simulate play: SP knocked down + a bay NPC wounded.
    const playedBayRef = must(must(crawler.crawlerBays)[0]).bayRef
    await useEntityStore.getState().update('crawler', crawler.id, { currentSP: 5 })
    await useEntityStore.getState().updateCrawlerBay(crawler.id, playedBayRef, {
      npcCurrentHP: 1,
      condition: 'damaged',
    })

    const played = must(useEntityStore.getState().get('crawler', crawler.id))
    const onComplete = mock(() => {})
    render(
      <CrawlerBuilder
        crawlerId={crawler.id}
        initialState={crawlerToFormState(played)}
        onComplete={onComplete}
        onCancel={() => {}}
      />
    )

    // Eyebrow flips to edit mode; the display-only Statistics step is hidden.
    expect(screen.getByText('Edit Crawler')).toBeTruthy()
    const rail = document.querySelector('nav[aria-label="Steps"]')
    expect(rail?.textContent).not.toContain('Statistics')

    // Legacy (untyped) crawler advances without a type — presence checks only.
    await waitFor(() => {
      expect(getNextButton().disabled).toBe(false)
    })
    await clickNext() // -> Armament Bay

    // Add a weapons system in edit mode (the catalog is weapons-only).
    const tl1 = weaponSystemAtTL(1)
    await waitFor(() => screen.getByRole('button', { name: tl1.name }))
    await pick(tl1.name)
    await clickNext() // Crew (all optional)
    await clickNext() // Name (prefilled)
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
      const c = must(crawlers[0])
      expect(c.id).toBe(crawler.id)
      expect(c.name).toBe('The Wandering Kettle')
      expect(c.systems).toEqual([tl1.id])
      // Live-play state untouched by the wizard patch.
      expect(c.currentSP).toBe(5)
      const bay = c.crawlerBays?.find((e) => e.bayRef === playedBayRef)
      expect(bay?.npcCurrentHP).toBe(1)
      expect(bay?.condition).toBe('damaged')
      expect(c.crawlerBays?.length).toBe(must(crawler.crawlerBays).length)
      // Assert inside waitFor: the wizard persists to the store before invoking
      // onComplete in a later microtask, so a bare assertion here races under
      // heavy parallel load.
      expect(onComplete).toHaveBeenCalledWith(crawler.id)
    })
  }, 30000)

  it('edit lifts the Tech-1 filter (all-TL weapons offered) and the hard cap', async () => {
    const crawler = await seedCrawler()
    const played = must(useEntityStore.getState().get('crawler', crawler.id))
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
    await clickNext() // -> Armament Bay

    // A TL2 weapon renders in edit mode (guided create filters it out).
    const tl2 = weaponSystemAtTL(2)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: tl2.name })).toBeTruthy()
    })

    // No hard cap: a second weapon stays selectable; the over-cap advisory
    // SoftWarningBanner appears instead (soft regime, §5.2).
    const tl1 = weaponSystemAtTL(1)
    await pick(tl1.name)
    await pick(tl2.name)
    await waitFor(() => {
      expect(screen.getByText(/Over capacity/i)).toBeTruthy()
    })
    // Still saveable — Next is not blocked by the overage.
    expect(getNextButton().disabled).toBe(false)
  }, 30000)

  it('preserves a higher stored tech level on save (only create fixes TL1)', async () => {
    // A pre-feature crawler at Tech 3 with no chosen type.
    const crawler = await seedCrawler({ techLevel: 3 })
    expect(crawler.techLevel).toBe('tech-3')
    const played = must(useEntityStore.getState().get('crawler', crawler.id))

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
    await clickNext() // Armament Bay
    await clickNext() // Crew
    await clickNext() // Name
    await clickNext() // Review

    const save = screen.getByRole('button', { name: /Save Crawler/i })
    await act(async () => {
      fireEvent.click(save)
    })

    await waitFor(() => {
      const c = must(useEntityStore.getState().get('crawler', crawler.id))
      expect(c.techLevel).toBe('tech-3')
    })
  }, 30000)

  it('changing the crawler TYPE on edit drops the old type NPC + bayChoices (no phantom bay)', async () => {
    const battle = must(SalvageUnionReference.Crawlers.find((c) => c.name === 'Battle'))
    const engineering = must(SalvageUnionReference.Crawlers.find((c) => c.name === 'Engineering'))

    // Seed a Battle crawler with a named Grizzled Veteran (type NPC) and a
    // Keepsake persisted in bayChoices keyed by the Battle type id.
    const input = crawlerFormToCreateInput(
      {
        name: 'War Wagon',
        description: '',
        techLevel: 1,
        type: battle.id,
        systems: [],
        crew: { [battle.id]: { name: 'Old Vex', keepsake: 'A dog tag' } },
        scrapPool: { ...EMPTY_SCRAP_POOL },
        upgradePool: 0,
      },
      { maxSP: 25, crawlerBays: seedDefaultCrawlerBays() }
    )
    const crawler = await useEntityStore.getState().create('crawler', input)
    expect(crawler.typeNpc?.npcName).toBe('Old Vex')
    expect(crawler.bayChoices?.[battle.id]).toBeTruthy()

    // Wound a real bay's NPC so we can prove live HP is preserved on save.
    const playedBayRef = must(must(crawler.crawlerBays)[0]).bayRef
    await useEntityStore.getState().updateCrawlerBay(crawler.id, playedBayRef, { npcCurrentHP: 1 })

    const played = must(useEntityStore.getState().get('crawler', crawler.id))
    render(
      <CrawlerBuilder
        crawlerId={crawler.id}
        initialState={crawlerToFormState(played)}
        onComplete={() => {}}
        onCancel={() => {}}
      />
    )

    // Switch the type: Battle → Engineering on the type step.
    await waitFor(() => screen.getByRole('radio', { name: 'Engineering' }))
    await pickType('Engineering')
    await clickNext() // Armament Bay
    await clickNext() // Crew
    await clickNext() // Name
    await clickNext() // Review

    const save = screen.getByRole('button', { name: /Save Crawler/i })
    await act(async () => {
      fireEvent.click(save)
    })

    await waitFor(() => {
      const c = must(useEntityStore.getState().get('crawler', crawler.id))
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
    // Regression: the Armament-Bay accounting counts WEAPONS only. A legacy
    // crawler that carries a non-weapon system (Cargo Pod, Armour Plating, …)
    // — which the old wizard allowed and which never appears in the
    // weapons-only catalog — must NOT count toward the cap math, and must be
    // preserved alongside a newly-mounted weapon on save.
    const nonWeapon = nonWeaponSystemAtTL(1)
    const input = crawlerFormToCreateInput(
      {
        name: 'Old Hauler',
        description: '',
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
    const played = must(useEntityStore.getState().get('crawler', crawler.id))

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
    await clickNext() // -> Armament Bay

    // The stranded non-weapon system triggers no over-capacity warning …
    expect(screen.queryByText(/Over capacity/i)).toBeNull()
    // … and the allowed weapon is still selectable — the picker is not locked.
    const weapon = weaponSystemAtTL(1)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: weapon.name })).toBeTruthy()
    })
    await pick(weapon.name)

    await clickNext() // Crew
    await clickNext() // Name
    await clickNext() // Review
    const save = screen.getByRole('button', { name: /Save Crawler/i })
    await act(async () => {
      fireEvent.click(save)
    })
    await waitFor(() => {
      const c = must(useEntityStore.getState().get('crawler', crawler.id))
      expect(c.systems).toContain(nonWeapon.id)
      expect(c.systems).toContain(weapon.id)
    })
  }, 30000)
})
