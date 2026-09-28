/**
 * Integration tests for CrawlerBuilder on the WizShell skeleton, in the
 * Union Crawler's book order (wizard-refresh Phase 5, pp.212–213):
 *
 *   Choose a Crawler Type (radio entity cards) → Note your Crawler
 *   Statistics (display-only) → Arm the Armament Bay (Tech-1
 *   weapons, min 1, mutations-derived cap) → Name your Crew (roster rows →
 *   IdentityFields) → Name your Crawler (name + scrap pool) → Review →
 *   submit.
 *
 * Uses the real wizard, real SalvageUnionReference data, real Zod validation,
 * and a fake-indexeddb-backed entityStore (fake-indexeddb/auto and the
 * reference dataset are both preloaded via bunfig.toml).
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { isWeaponSystem } from 'salvageunion-reference/rules'
import { _clearAllStores, _resetDbSingleton } from '../../../lib/db/index'
import { withSignedInBackend } from '../../../stores/__tests__/signedInBackend'
import { useEntityStore } from '../../../stores/entityStore'
import { must } from '../../__tests__/must'
import { CrawlerBuilder } from '../CrawlerBuilder'

// These assert durability — a write surviving a rehydrate or a direct read of
// IndexedDB — and only the signed-in backend is durable. See signedInBackend.ts.
withSignedInBackend()

// ---------------------------------------------------------------------------
// Pre-load reference data
// ---------------------------------------------------------------------------

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
  return screen.getByRole<HTMLButtonElement>('button', { name: /^Next ·/ })
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
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: editLabel })
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
