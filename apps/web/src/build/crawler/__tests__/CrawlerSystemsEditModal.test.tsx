/**
 * CrawlerSystemsEditModal — the live sheet's weapons-systems editor.
 *
 * Pins what the picker offers (weapons only, craftable at the crawler's tech
 * level, plus anything already installed even above it), the soft one/two-
 * weapon budget (Battle crawlers mount two), and that each toggle writes
 * through the fresh-read updater, so a second toggle never overwrites the
 * first.
 *
 * Renders against the real systems catalogue.
 */

import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { Crawler } from 'cantina-domain/schemas/crawler'
import { crawlerFixture } from '../../../components/__tests__/fixtures'
import { pickInSearcher, searcherToken } from '../../../components/__tests__/searcherPick'
import { CrawlerSystemsEditModal } from '../CrawlerSystemsEditModal'

type Patch = Partial<Crawler> | ((current: Crawler) => Partial<Crawler>)

/** The searcher renders a pool of Tokens and a Card; give the heavier renders room. */
const RENDER_TIMEOUT_MS = 10_000

function renderModal(crawler: Crawler) {
  const patches: Patch[] = []
  const onClose = mock(() => {})
  render(
    <CrawlerSystemsEditModal
      open
      onClose={onClose}
      crawler={crawler}
      patch={(p) => {
        patches.push(p)
      }}
    />
  )
  return { patches, onClose }
}

/** Run a recorded patch against a crawler, as the sheet's fresh-read updater does. */
function applyPatch(patch: Patch | undefined, current: Crawler): Partial<Crawler> {
  if (patch === undefined) throw new Error('no patch recorded')
  return typeof patch === 'function' ? patch(current) : patch
}

/** The rail's budget Stat, as text ("1/1"): its value and max are separate nodes. */
const budgetText = () => screen.getByRole('region', { name: /armed/i }).textContent

/** An option's Token in the searcher's list. */
const option = (name: string) => searcherToken(name)

describe('CrawlerSystemsEditModal', () => {
  test(
    'offers only weapons at the crawler’s tech level, keeping an installed one above it',
    () => {
      renderModal(crawlerFixture({ id: 'c1', techLevel: 'tech-1', systems: ['ion-cannon'] }))

      expect(screen.getAllByText('Edit Weapons Systems · Tech 1 and below').length).toBeGreaterThan(
        0
      )
      // A TL1 weapon is offered; a TL2 weapon and a non-weapon are not.
      expect(option('Red Laser')).not.toBeNull()
      expect(option('30mm Autocannon')).toBeNull()
      expect(option('Armour Plating')).toBeNull()
      // Ion Cannon is TL5, but installed: it stays, so it can be removed.
      expect(option('Ion Cannon')).not.toBeNull()
    },
    RENDER_TIMEOUT_MS
  )

  test(
    'toggling adds and removes one weapon on the freshest systems array',
    async () => {
      const crawler = crawlerFixture({ id: 'c1', techLevel: 'tech-1', systems: ['ion-cannon'] })
      const { patches } = renderModal(crawler)

      await pickInSearcher('Red Laser')
      // The updater reads the CURRENT record, not the one the modal rendered with:
      // a write that landed in between (here, Mini Mortar) survives.
      const fresher = { ...crawler, systems: ['ion-cannon', 'mini-mortar'] }
      expect(applyPatch(patches[0], fresher)).toEqual({
        systems: ['ion-cannon', 'mini-mortar', 'red-laser'],
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Remove Ion Cannon' }))
      })
      expect(applyPatch(patches[1], fresher)).toEqual({ systems: ['mini-mortar'] })
    },
    RENDER_TIMEOUT_MS
  )

  test(
    'the budget is one weapon, and two on a Battle crawler',
    () => {
      renderModal(crawlerFixture({ id: 'c1', techLevel: 'tech-1', systems: ['red-laser'] }))
      expect(budgetText()).toMatch(/1\s*\/\s*1/)
    },
    RENDER_TIMEOUT_MS
  )

  test(
    'a Battle crawler mounts two',
    () => {
      renderModal(
        crawlerFixture({ id: 'c1', techLevel: 'tech-1', type: 'battle', systems: ['red-laser'] })
      )
      expect(budgetText()).toMatch(/1\s*\/\s*2/)
    },
    RENDER_TIMEOUT_MS
  )

  test(
    'with no readable tech level only installed weapons are offered',
    () => {
      renderModal(crawlerFixture({ id: 'c1', techLevel: 'unknown', systems: ['ion-cannon'] }))
      expect(screen.getAllByText('Edit Weapons Systems · Tech — and below').length).toBeGreaterThan(
        0
      )
      expect(option('Ion Cannon')).not.toBeNull()
      expect(option('Red Laser')).toBeNull()
    },
    RENDER_TIMEOUT_MS
  )
})
