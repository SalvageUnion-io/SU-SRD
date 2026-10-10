/**
 * CrawlerSheet — a bay crewed by a built NPC (Q2, ADR-043).
 *
 * While linked, the bay shows the NPC read-only, stamped User-made with a way
 * to its sheet, in place of the inline crew — and writes nothing to the
 * crawler, so the inline crew is there unchanged when the link goes. A link
 * whose NPC this view cannot read shows the inline crew with a badge.
 */

import { describe, expect, mock, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import type { CrewAssignment } from '../../../lib/npcs/npcModel'
import type { Crawler } from '../../../lib/schemas/crawler'
import { expandCards } from '../../__tests__/expandCards'
import { crawlerFixture, npcFixture, softLinkFixture } from '../../__tests__/fixtures'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import { CrawlerSheet } from '../CrawlerSheet'

const crawler: Crawler = crawlerFixture({
  id: 'c1',
  name: '#430 Tenacity',
  crawlerBays: [
    { bayRef: 'med-bay', npcName: 'Old Mags', npcCurrentHP: 3 },
    { bayRef: 'command-bay', npcName: 'Ilsa Varn' },
  ],
})

const DOC = npcFixture({
  id: 'n1',
  name: 'Doc Ambrose',
  position: 'Doc',
  hitPoints: 4,
  motto: 'Bleed later.',
})

const MED_BAY_LINK = softLinkFixture('npc-to-crawler', 'n1', 'c1')

function store() {
  return makeEntityStoreMock({
    crawlers: [crawler],
    update: mock(async () => crawler),
    updateCrawlerBay: mock(async () => crawler),
  })
}

function assigned(npc: CrewAssignment['npc']): CrewAssignment[] {
  return [{ link: MED_BAY_LINK, slot: { kind: 'bay', bayRef: 'med-bay' }, npcId: 'n1', npc }]
}

describe('a linked bay shows its NPC in place of the inline crew', () => {
  test('read-only, stamped, with a way to its sheet', () => {
    render(<CrawlerSheet crawler={crawler} store={store()} crew={assigned(DOC)} />)
    expandCards()

    const inset = screen.getByLabelText('Med Bay crew lead')
    expect(within(inset).getByText('Doc Ambrose')).toBeTruthy()
    expect(within(inset).getByText('Bleed later.')).toBeTruthy()
    expect(screen.queryByText('Old Mags')).toBeNull()
    expect(screen.getByText('User-made crew')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open Doc Ambrose' })).toHaveProperty(
      'href',
      expect.stringContaining('/sheet/npc/n1')
    )
    // No edit control writes the crawler's inline crew while it is linked.
    expect(within(inset).queryByRole('button', { name: /Edit Med Bay crew/ })).toBeNull()
  })

  test('an unlinked bay beside it keeps its inline crew, editable', () => {
    render(<CrawlerSheet crawler={crawler} store={store()} crew={assigned(DOC)} />)
    expandCards()
    const inset = screen.getByLabelText('Command Bay crew lead')
    expect(within(inset).getByText('Ilsa Varn')).toBeTruthy()
    expect(within(inset).getByRole('button', { name: /Edit Command Bay crew name/ })).toBeTruthy()
  })

  test('a link whose NPC cannot be read shows the inline crew and says so, never a blank', () => {
    render(<CrawlerSheet crawler={crawler} store={store()} crew={assigned(null)} />)
    expandCards()
    expect(screen.getByText('Assigned NPC unavailable')).toBeTruthy()
    expect(within(screen.getByLabelText('Med Bay crew lead')).getByText('Old Mags')).toBeTruthy()
  })

  test('with no link, the inline crew is the crew', () => {
    render(<CrawlerSheet crawler={crawler} store={store()} crew={[]} />)
    expandCards()
    expect(within(screen.getByLabelText('Med Bay crew lead')).getByText('Old Mags')).toBeTruthy()
    expect(screen.queryByText('User-made crew')).toBeNull()
  })
})

describe('the Bays section links to the crew board (D8)', () => {
  test('one Crew… link, for this crawler', () => {
    render(
      <CrawlerSheet crawler={crawler} store={store()} crewHref="/npcs/new?view=crew&crawler=c1" />
    )
    expect(
      screen.getByRole('link', { name: /Crew #430 Tenacity: design and assign crawler crew/ })
    ).toBeTruthy()
  })
})
