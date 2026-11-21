/**
 * No crawler counts its bays (R46): the rendered sheet, Read and Edit, has no
 * Bays figure on its strip and no "n/m Intact" tally on its Bays head, the
 * Training Bay shelf no Bays column, and a crawler's rail reading no bay
 * count. A damaged bay says so on its own line.
 */

import { describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import { crawlerFixture } from '../../../components/__tests__/fixtures'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import { CRAWLER_COLUMNS } from '../../shelves/shelfColumns'
import { CrawlerSheet } from '../CrawlerSheet'
import { crawlerRailItems } from '../railStats.model'

const crawler = crawlerFixture({
  id: 'crawler-bays-1',
  name: 'Tenacity',
  techLevel: 2,
  crawlerBays: [{ bayRef: 'pilot-bay' }, { bayRef: 'command-bay', condition: 'damaged' }],
})

describe('no crawler counts its bays (R46)', () => {
  for (const readOnly of [true, false]) {
    test(`the rendered sheet in ${readOnly ? 'Read' : 'Edit'}`, () => {
      const { container } = render(
        <CrawlerSheet
          crawler={crawler}
          store={makeSingleUnitStore('crawler', crawler)}
          readOnly={readOnly}
        />
      )
      const figures = container.querySelector('.su-strip__figures')?.textContent ?? ''
      expect(figures).not.toMatch(/bays/i)
      const bays = screen.getByRole('table', { name: /^Bays/ })
      const head = must(bays.querySelector('thead')).textContent ?? ''
      expect(head).not.toMatch(/\d+\s*\/\s*\d+/)
      expect(head).not.toMatch(/intact/i)
      expect(within(bays).getAllByText(/Damaged/).length).toBeGreaterThan(0)
    })
  }

  test('the shelf and the rail', () => {
    expect(CRAWLER_COLUMNS.map((column) => column.title ?? column.label).join(' ')).not.toMatch(
      /bays/i
    )
    expect(crawlerRailItems(crawler).map((item) => item.label)).toEqual(['SP'])
  })
})

function must<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('missing')
  return value
}
