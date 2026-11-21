/**
 * CrawlerSheet — a bay is a line of the crew manifest, in Read and in Edit:
 * its rules and its damaged clause wait behind the line until the reader
 * opens it. Real SRD bays (Pilot Bay, Trading Bay), no patched rows.
 */

import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import type { Crawler } from 'game-domain/schemas/crawler'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import { CrawlerSheet } from '../CrawlerSheet'

const crawler: Crawler = {
  id: 'crawler-fold-1',
  schemaVersion: 1,
  name: 'Tenacity',
  techLevel: 3,
  crawlerBays: [{ bayRef: 'pilot-bay' }, { bayRef: 'trading-bay' }],
  systems: [],
  currentSP: 25,
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
}

const store = () => makeSingleUnitStore('crawler', crawler)

/** Shown: in the document and under no shut fold. */
function shown(text: string | RegExp): boolean {
  const node = screen.queryByText(text)
  return node !== null && node.closest('[hidden]') === null
}

const TRAINING = 'Pilot Training Points (TP)'
const PILOT_DAMAGED = /If the Pilot Bay is damaged, you cannot train/

describe('a crawler bay on the sheet', () => {
  for (const readOnly of [true, false]) {
    test(`in ${readOnly ? 'Read' : 'Edit'} its line starts shut and opens its rules`, () => {
      render(<CrawlerSheet crawler={crawler} store={store()} readOnly={readOnly} />)
      expect(shown(TRAINING)).toBe(false)
      expect(shown(PILOT_DAMAGED)).toBe(false)
      fireEvent.click(screen.getByRole('button', { name: 'Pilot Bay rules and crew' }))
      expect(shown(TRAINING)).toBe(true)
      expect(shown(PILOT_DAMAGED)).toBe(true)
    })
  }
})
