/**
 * The unified edit-language control chrome.
 *
 *   - the section header row: a solid `Slab` (stamp label + leader rule +
 *     trailing controls) — the shape the sheets' field/collection sections use.
 *   - a collection section's Manage control: the house `Button` in the
 *     `SlabSection`'s `actions`, Compact as the fold beside it (§4.7), never
 *     a header button of the sheets' own.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import type { Pilot } from 'game-domain/schemas/pilot'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import { Slab } from '../../../components/index'
import { PilotSheet } from '../PilotSheet'

beforeAll(hydrateStores)

describe('section header (solid Slab)', () => {
  test('renders the stamp label and the trailing actions', () => {
    render(<Slab label="Identity" actions={<button type="button">Edit</button>} />)
    expect(screen.getByText('Identity')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })

  test('renders without an actions slot when none is given', () => {
    render(<Slab label="Bio" />)
    expect(screen.getByText('Bio')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

const PILOT: Pilot = {
  id: 'pilot-manage-1',
  schemaVersion: 1,
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
  currentHP: 10,
  currentAP: 5,
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
}

const store = () => makeSingleUnitStore('pilot', PILOT)

describe("a collection section's Manage control", () => {
  test("is a Compact Button in its SlabSection's actions, and opens the picker", () => {
    render(<PilotSheet pilot={PILOT} store={store()} />)
    for (const name of ['Manage Abilities', 'Manage Equipment']) {
      const button = screen.getByRole('button', { name })
      expect(button.getAttribute('type')).toBe('button')
      expect(button.classList.contains('su-btn')).toBe(true)
      expect(button.closest('.su-slab-section__head')).toBeTruthy()
      expect(button.className).not.toContain('su-sheet-hbtn')
    }
    fireEvent.click(screen.getByRole('button', { name: 'Manage Equipment' }))
    expect(screen.getByRole('dialog', { name: 'Add Equipment' })).toBeTruthy()
  })

  test('Read draws none', () => {
    render(<PilotSheet pilot={PILOT} store={store()} readOnly />)
    expect(screen.queryByRole('button', { name: /^Manage / })).toBeNull()
  })
})
