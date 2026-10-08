/**
 * The override colour means "the player changed this number", and nothing else.
 *
 * Reported on Pilot HP: a player pinned a max, then received upgrades, then
 * deleted the override — and the max still read in the rust override colour
 * although their pin matched what the rules now derive. The rule the player
 * asked for, verbatim: "If a bonus would provide +0, nullify it for the
 * purposes of modification … it should only be red when that value has been
 * manually modified."
 *
 * So the max renders overridden — rust numeral, `*`, ↺, "overridden from N",
 * and an Override line in the ledger — if and only if the stored pin differs
 * from what the rules derive right now. All five read ONE flag
 * (`StatBreakdown.overridden`), so they cannot disagree.
 *
 * Driven through the real store and the real Live Sheet. "Upgrades" are the two
 * sources of pilot HP: the home crawler's Tech Level (Stat Training, +2 per
 * tier above 1) and HP-granting abilities (Bionic Arms / Bionic Legs, +2 each).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import {
  act,
  configure,
  fireEvent,
  getConfig,
  render,
  waitFor,
  within,
} from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { _clearAllStores, _resetDbSingleton } from '../../../lib/db/index'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { Pilot } from '../../../lib/schemas/pilot'
import { withSignedInBackend } from '../../../stores/__tests__/signedInBackend'
import { useEntityStore } from '../../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../../stores/surfaceProvenance'
import { Sheet } from '../Sheet'

// Building and editing need an account (ADR-034 as amended), so these writes run signed in.
withSignedInBackend()

const basePilotInput = {
  schemaVersion: 1 as const,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: [] as string[],
  equipment: [] as string[],
  motto: '',
  keepsake: '',
  appearance: '',
  background: '',
  conditions: [] as string[],
}

/** The pilot sheet's override tone: `--tone-deep` (rust on the pilot sheet). */
const OVERRIDE_TONE = 'text-[var(--tone-deep)]'

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
})

// A failed query's default error pretty-prints its container — here the whole
// Live Sheet, on every waitFor retry. Keep the message, drop the DOM dump.
const defaultElementError = getConfig().getElementError
beforeAll(() => {
  configure({ getElementError: (message) => new Error(message ?? 'element query failed') })
})
afterAll(() => {
  configure({ getElementError: defaultElementError })
})

function abilityId(name: string): string {
  const ability = SalvageUnionReference.Abilities.getByName(name)
  if (!ability) throw new Error(`Fixture setup: ability "${name}" not found in reference`)
  return ability.id
}

/** A base-10 pilot whose home crawler is Tech 1 (no Stat Training yet). */
async function seedPilot(): Promise<{ pilot: Pilot; crawler: Crawler }> {
  const store = useEntityStore.getState()
  const pilot = await store.create('pilot', basePilotInput)
  const crawler = await store.create('crawler', {
    schemaVersion: 1,
    name: 'The Wanderer',
    techLevel: 'tech-1',
    systems: [],
  })
  await store.create('softLink', {
    from: { type: 'pilot', id: pilot.id },
    to: { type: 'crawler', id: crawler.id },
    type: 'pilot-to-crawler',
  })
  render(<Sheet kind="pilot" id={pilot.id} />)
  await waitFor(() => expect(hpGauge()).toBeTruthy())
  return { pilot, crawler }
}

/**
 * The HP gauge's own subtree. Queries are scoped to it because a role query
 * over the whole Live Sheet (every ability card) costs seconds per call.
 */
function hpGauge(): HTMLElement {
  const el = document.querySelector<HTMLElement>('[role="group"][aria-label^="HP "]')
  if (!el) throw new Error('HP gauge not rendered')
  return el
}

function storedPin(pilotId: string): number | undefined {
  return useEntityStore.getState().get('pilot', pilotId)?.maxHpOverride
}

async function typeMax(next: number): Promise<void> {
  await act(async () => {
    fireEvent.click(within(hpGauge()).getByRole('button', { name: /override hp max/i }))
  })
  const input = within(hpGauge()).getByLabelText('Set HP max')
  await act(async () => {
    fireEvent.change(input, { target: { value: String(next) } })
    fireEvent.keyDown(input, { key: 'Enter' })
  })
}

async function upgrade(write: () => Promise<unknown>): Promise<void> {
  await act(async () => {
    await write()
  })
}

/** The HP max numeral, once it reads `value`. */
async function hpMax(value: number): Promise<HTMLElement> {
  let max: HTMLElement | null = null
  await waitFor(() => {
    max = within(hpGauge()).getByRole('button', {
      name: new RegExp(`override hp max \\(currently ${value}\\)`, 'i'),
    })
  })
  if (!max) throw new Error(`HP max never read ${value}`)
  return max
}

/** Every override affordance on the HP gauge, read together. */
async function expectNotOverridden(value: number): Promise<void> {
  const max = await hpMax(value)
  const gauge = within(hpGauge())
  expect(max.className).not.toContain(OVERRIDE_TONE)
  expect(gauge.queryByText('*')).toBeNull()
  expect(gauge.queryByRole('button', { name: /revert hp max/i })).toBeNull()
  expect(gauge.queryByText(/overridden from/i)).toBeNull()
  // The ledger agrees: no Derived/Override lines tacked onto the derivation.
  expect(await ledgerText()).not.toContain('pinned by hand')
}

/**
 * Open the HP provenance panel and read it. Read as text from the portal
 * rather than through `screen` queries, which walk the whole Live Sheet.
 */
async function ledgerText(): Promise<string> {
  const trigger = within(hpGauge()).getByRole('button', { name: /max hp: how this is derived/i })
  await act(async () => {
    fireEvent.click(trigger)
  })
  let text = ''
  await waitFor(() => {
    const popup = [...document.querySelectorAll('[role="dialog"]')].find((el) =>
      el.textContent?.includes('Max HP · how this is derived')
    )
    if (!popup) throw new Error('HP provenance panel did not open')
    text = popup.textContent ?? ''
  })
  await act(async () => {
    fireEvent.click(trigger)
  })
  return text
}

async function expectOverridden(value: number, from: number): Promise<void> {
  const max = await hpMax(value)
  const gauge = within(hpGauge())
  expect(max.className).toContain(OVERRIDE_TONE)
  expect(gauge.getByText('*')).toBeTruthy()
  expect(
    gauge.getByRole('button', { name: new RegExp(`revert hp max to derived ${from}`, 'i') })
  ).toBeTruthy()
  expect(gauge.getByText(new RegExp(`overridden from ${from}`, 'i'))).toBeTruthy()
  expect(await ledgerText()).toContain('pinned by hand')
}

async function revert(from: number): Promise<void> {
  await act(async () => {
    fireEvent.click(
      within(hpGauge()).getByRole('button', {
        name: new RegExp(`revert hp max to derived ${from}`, 'i'),
      })
    )
  })
}

describe('Pilot HP — the override colour tracks a real modification (ADR-022)', () => {
  test('pin, upgrades catch up, the player re-types the derived value: never rust again', async () => {
    const { pilot, crawler } = await seedPilot()
    const store = useEntityStore.getState()

    // 1. The player pins a max above the derivation.
    await typeMax(14)
    await expectOverridden(14, 10)
    expect(storedPin(pilot.id)).toBe(14)

    // 2. Upgrades arrive: Stat Training (Tech 2, +2) and Bionic Arms (+2).
    //    The rules now derive exactly the pinned value — a +0 modification.
    await upgrade(() =>
      store.update('crawler', crawler.id, { techLevel: 'tech-2' }, LIVE_SHEET_MANUAL)
    )
    await upgrade(() =>
      store.update('pilot', pilot.id, { abilities: [abilityId('Bionic Arms')] }, LIVE_SHEET_MANUAL)
    )
    await expectNotOverridden(14)

    // 3. The player deletes the override by typing the derived value.
    await typeMax(14)
    await waitFor(() => expect(storedPin(pilot.id)).toBeUndefined())

    // 4. The next upgrade raises the max, and nothing reads as overridden.
    await upgrade(() =>
      store.update(
        'pilot',
        pilot.id,
        { abilities: [abilityId('Bionic Arms'), abilityId('Bionic Legs')] },
        LIVE_SHEET_MANUAL
      )
    )
    await expectNotOverridden(16)
  })

  test('↺ after upgrades lands on the derivation and drops every override mark', async () => {
    const { pilot, crawler } = await seedPilot()

    await typeMax(20)
    await upgrade(() =>
      useEntityStore
        .getState()
        .update('crawler', crawler.id, { techLevel: 'tech-3' }, LIVE_SHEET_MANUAL)
    )
    await expectOverridden(20, 14)

    await revert(14)
    await waitFor(() => expect(storedPin(pilot.id)).toBeUndefined())
    await expectNotOverridden(14)
  })

  test('typing the max back down to the derivation clears the pin', async () => {
    const { pilot, crawler } = await seedPilot()

    await typeMax(20)
    await upgrade(() =>
      useEntityStore
        .getState()
        .update('crawler', crawler.id, { techLevel: 'tech-3' }, LIVE_SHEET_MANUAL)
    )
    await expectOverridden(20, 14)

    await typeMax(14)
    await waitFor(() => expect(storedPin(pilot.id)).toBeUndefined())
    await expectNotOverridden(14)
  })

  test('an untouched pin the upgrades caught up with reads plain, then flags (with ↺) once they pass it', async () => {
    // The deliberate decision for a pin nobody touched: it is still the
    // player's absolute pin (ADR-022), so it stays stored — but while it adds
    // +0 it is not a modification and reads as derived. When the derivation
    // moves past it, the pin IS a modification again, so it flags and the
    // revert is right there.
    const { pilot, crawler } = await seedPilot()
    const store = useEntityStore.getState()

    await typeMax(14)
    await upgrade(() =>
      store.update('crawler', crawler.id, { techLevel: 'tech-3' }, LIVE_SHEET_MANUAL)
    )
    await expectNotOverridden(14)

    await upgrade(() =>
      store.update('crawler', crawler.id, { techLevel: 'tech-4' }, LIVE_SHEET_MANUAL)
    )
    await expectOverridden(14, 16)

    await revert(16)
    await waitFor(() => expect(storedPin(pilot.id)).toBeUndefined())
    await expectNotOverridden(16)
  })
})
