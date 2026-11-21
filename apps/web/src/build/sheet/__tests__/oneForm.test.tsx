/**
 * R11a One form a list — a sheet's lists keep their form across Read and
 * Edit: every section Read draws (`[data-form]`, keyed by its title) is drawn
 * in Edit in the same form. Edit adds controls and the sections only it
 * fills, never a second layout.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { expandCards } from '../../../components/__tests__/expandCards'
import { crawlerFixture, mechFixture, pilotFixture } from '../../../components/__tests__/fixtures'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import { CrawlerSheet } from '../CrawlerSheet'
import { MechSheet } from '../MechSheet'
import { PilotSheet } from '../PilotSheet'

beforeAll(hydrateStores)

const pilot = pilotFixture({
  id: 'form-pilot',
  classRef: 'scavenger',
  abilities: ['talk-shop'],
  equipment: ['rifle'],
})
const mech = mechFixture({
  id: 'form-mech',
  chassisRef: 'iron-mongrel',
  systems: ['autocannon'],
  modules: ['ai-module'],
})
const crawler = crawlerFixture({
  id: 'form-crawler',
  crawlerBays: [{ bayRef: 'command-bay' }, { bayRef: 'armament-bay' }],
  systems: ['mini-mortar'],
})

/** Each list's form by its section's title. */
function forms(view: ReactElement): Map<string, string> {
  const { container } = render(view)
  expandCards()
  const found = new Map<string, string>()
  for (const el of container.querySelectorAll<HTMLElement>('[data-form]')) {
    const labelledBy = el.getAttribute('aria-labelledby')
    const title = labelledBy
      ? container.querySelector(`[id="${labelledBy}"]`)?.textContent
      : el.closest('.su-dash-group')?.querySelector('h2, h3, h4')?.textContent
    found.set((title ?? '?').trim(), el.dataset.form ?? '')
  }
  cleanup()
  return found
}

const SHEETS: [string, (readOnly: boolean) => ReactElement][] = [
  [
    'pilot',
    (readOnly) => (
      <PilotSheet pilot={pilot} store={makeSingleUnitStore('pilot', pilot)} readOnly={readOnly} />
    ),
  ],
  [
    'mech',
    (readOnly) => (
      <MechSheet mech={mech} store={makeSingleUnitStore('mech', mech)} readOnly={readOnly} />
    ),
  ],
  [
    'crawler',
    (readOnly) => (
      <CrawlerSheet
        crawler={crawler}
        store={makeSingleUnitStore('crawler', crawler)}
        readOnly={readOnly}
      />
    ),
  ],
]

describe('R11a: Read and Edit draw each list in one form', () => {
  for (const [kind, sheet] of SHEETS) {
    test(kind, () => {
      const read = forms(sheet(true))
      const edit = forms(sheet(false))
      expect(read.size).toBeGreaterThan(0)
      for (const [title, form] of read) {
        expect({ title, form: edit.get(title) }).toEqual({ title, form })
      }
    })
  }
})
