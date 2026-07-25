/**
 * Partner rows on the two host sheets.
 *
 * The assertion that matters is the TECH LEVEL, because it is the one thing
 * that differs between the two hosts and it fails silently: a pilot-granted
 * partner scales off the Union Crawler (Core Book pp.29/48/68) while a
 * mech-granted drone is fixed by its stat block, and either branch renders
 * plausible numbers when wrong.
 *
 * The tone assertion pins the sixth ontology hue: a partner row must NOT read
 * as a mech row, which is precisely the confusion the new hue exists to stop
 * (partner rows sit directly beneath a mech's own linked units).
 */

import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { PartnerRows } from '../PartnerRows'
import type { PartnerInstance } from '../../../lib/schemas/partner'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

const partner = (over: Partial<PartnerInstance>): PartnerInstance => ({
  id: 'partner-1',
  hostRef: 'survey-drone',
  hostSchema: 'equipment',
  systems: [],
  modules: [],
  conditions: [],
  ...over,
})

describe('PartnerRows', () => {
  test('renders nothing when the host has no partners', () => {
    const { container } = render(<PartnerRows partners={[]} />)
    expect(container.textContent).toBe('')
  })

  test('a named partner shows its own name, with the stat block as its role', () => {
    render(<PartnerRows partners={[partner({ name: 'Custos' })]} crawlerTechLevel={2} />)
    expect(screen.getAllByText('Custos').length).toBeGreaterThan(0)
    // Renaming a partner must not hide WHAT it is.
    expect(screen.getAllByText('Survey Drone').length).toBeGreaterThan(0)
  })

  test('an unnamed partner falls back to the stat block name', () => {
    render(<PartnerRows partners={[partner({})]} crawlerTechLevel={1} />)
    expect(screen.getAllByText('Survey Drone').length).toBeGreaterThan(0)
  })

  test('links to the partner sheet — the only route a partner has', () => {
    render(<PartnerRows partners={[partner({ id: 'abc' })]} />)
    const link = screen
      .getAllByRole('link')
      .find((a) => a.getAttribute('href') === '/sheet/partner/abc')
    expect(link).toBeTruthy()
  })

  test('a PILOT-granted partner takes the Union Crawler tech level and scales with it', () => {
    // Survey Drone base: SP 2, +2 per level above the first. At crawler Tech 3
    // that is 2 + 2*2 = 6 — NOT the base row.
    render(<PartnerRows partners={[partner({})]} crawlerTechLevel={3} />)
    expect(screen.getAllByText(/Tech 3/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('6/6').length).toBeGreaterThan(0)
  })

  test('a MECH-granted drone ignores the crawler and stays at its fixed tech level', () => {
    // Sestra Drone is Tech 3, SP 7, with no bonusPerTechLevel. Passing a Tech 6
    // crawler must change nothing.
    render(
      <PartnerRows
        partners={[partner({ hostRef: 'sestra-drone', hostSchema: 'drones' })]}
        crawlerTechLevel={6}
      />
    )
    expect(screen.getAllByText(/Tech 3/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('7/7').length).toBeGreaterThan(0)
  })

  test('rows carry the partner tone, not the mech tone', () => {
    const { container } = render(<PartnerRows partners={[partner({})]} />)
    const html = container.innerHTML
    expect(html).toContain('--color-sheet-partner-deep')
    expect(html).not.toContain('--color-sheet-mech-deep')
  })

  test('two of the same partner render as two distinct rows', () => {
    // The ADR-023 bug in UI form: slug-keyed loadouts could not express Mecha
    // Packmaster's second companion at all.
    render(
      <PartnerRows
        partners={[
          partner({ id: 'a', hostRef: 'mecha-companion', name: 'Incitatus' }),
          partner({ id: 'b', hostRef: 'mecha-companion', name: 'Bucephalus' }),
        ]}
        crawlerTechLevel={3}
      />
    )
    expect(screen.getAllByText('Incitatus').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Bucephalus').length).toBeGreaterThan(0)
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(links).toContain('/sheet/partner/a')
    expect(links).toContain('/sheet/partner/b')
  })
})
