/**
 * CrawlerBayCard — a bay on the crawler sheet is drawn as the SRD's bay Page
 * draws it: no `[Bay | Standard]` pill right of its title, no kind on its
 * foot (EDL E9: only a Page's foot names it), and, while intact, the book's
 * "When Damaged" callout.
 */

import { describe, expect, mock, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import { CrawlerBayCard } from '../CrawlerSheetItems'

function makeEmptyStore() {
  return makeEntityStoreMock({
    hydrated: { pilots: false, mechs: false, crawlers: true, npcs: true, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => []),
    get: mock(() => null),
    create: mock(async () => null),
    update: mock(async () => null),
    delete: mock(async () => {}),
  })
}

function renderBay(condition: 'intact' | 'damaged') {
  return render(
    <CrawlerBayCard
      crawlerId="crawler-1"
      entry={{ bayRef: 'command-bay', condition }}
      index={0}
      crawlerTl={1}
      repairShortfall={0}
      onRepair={() => {}}
      seedSelections={undefined}
      store={makeEmptyStore()}
      readOnly
    />
  )
}

describe('CrawlerBayCard anatomy', () => {
  test('no kind pill in the head and no kind on the foot', () => {
    const { container } = renderBay('intact')
    // What the eye reads: the title's kind is for screen readers only.
    const seen = container.cloneNode(true) as HTMLElement
    for (const hidden of seen.querySelectorAll('.su-sr-only')) hidden.remove()
    expect(seen.textContent).not.toMatch(/standard/i)
    expect(seen.textContent).not.toMatch(/crawler bay/i)
  })

  test('an intact bay shows the book\'s "When Damaged" callout', () => {
    renderBay('intact')
    expect(screen.getAllByText(/when damaged/i)).toHaveLength(1)
  })

  test('a damaged bay says the clause once', () => {
    renderBay('damaged')
    expect(screen.getAllByText(/when damaged/i)).toHaveLength(1)
  })
})
