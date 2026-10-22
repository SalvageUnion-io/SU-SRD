/**
 * CrawlerSheet — per-bay crew lead (CrewLeadMini) tests.
 *
 * Each bay card's `expand` slot renders the crew lead as a contentful Mini
 * (N3): its head (name, role, HP) Peeks the bay's NPC, and its body holds the
 * keepsake / motto / detail / facts and, in Edit, the name and HP (max 4)
 * fields. No titled box nests in the bay (N5).
 *
 * Asserts that:
 *   1. Name, detail (description) and facts persist via the store-level
 *      per-bay merge (updateCrawlerBay), without clobbering sibling bays.
 *   2. HP pip click-to-set persists npcCurrentHP via the per-bay merge.
 *   3. Keepsake persists through the bay NPC's SRD freeform 'Keepsake' choice
 *      into the crawler's bayChoices map (store.update).
 *   4. The SRD role title (npc.position) renders read-only.
 *   5. Read and Edit both draw the crew as one contentful Mini; readOnly
 *      exposes no edit controls.
 *   6. CrawlerSchema round-trips the bay entry fields (snapshot path).
 *
 * Uses the store-injection seam + a patched CrawlerBays.all. NO mock.module().
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { Crawler } from 'game-domain/schemas/crawler'
import { CrawlerSchema } from 'game-domain/schemas/crawler'
import type { RefCrawlerBay } from 'salvageunion-reference'
import { patchModelRows } from '../../../../test/patchModel'
import { expandCards } from '../../../components/__tests__/expandCards'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { makeEntityStoreMock } from '../../../components/__tests__/mockEntityStore'
import type { useEntityStore } from '../../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../../stores/surfaceProvenance'
import { CrawlerSheet } from '../CrawlerSheet'

/** Open every crew lead's Details: in Edit a crew lead starts collapsed, its fields behind it. */
function openCrewDetails() {
  for (const toggle of screen.queryAllByRole('button', { name: /^Edit .* crew details$/ })) {
    fireEvent.click(toggle)
  }
}

// ---------------------------------------------------------------------------
// SalvageUnionReference.CrawlerBays.all patch (so bays resolve in the sheet)
// ---------------------------------------------------------------------------

/** The crew Mini's head (its Peek trigger), by the name it wears. */
function crewMini(name: string): Element {
  const head = Array.from(document.querySelectorAll('.su-entity-mini__name'))
    .find((n) => n.textContent?.startsWith(name))
    ?.closest('.su-entity-mini__head')
  if (!head) throw new Error(`no crew Mini named ${name}`)
  return head
}

const KEEPSAKE_CHOICE_ID = 'command-bay-keepsake-1'
const MOTTO_CHOICE_ID = 'command-bay-motto-1'

const MOCK_BAYS: Array<RefCrawlerBay & { schemaName: string }> = [
  {
    id: 'command-bay',
    name: 'Command Bay',
    schemaName: 'crawler-bays',
    source: 'Salvage Union Workshop Manual',
    page: 1,
    blackMarket: false,
    npc: {
      position: 'Princeps',
      hitPoints: 4,
      choices: [
        { id: 'command-bay-name-1', name: 'Name' },
        { id: KEEPSAKE_CHOICE_ID, name: 'Keepsake' },
        { id: MOTTO_CHOICE_ID, name: 'Motto' },
      ],
    },
  },
  {
    id: 'mech-bay',
    name: 'Mech Bay',
    schemaName: 'crawler-bays',
    source: 'Salvage Union Workshop Manual',
    page: 1,
    blackMarket: false,
    npc: { position: 'Greaser', hitPoints: 4 },
  },
]

async function patchCrawlerBays(): Promise<() => void> {
  const { SalvageUnionReference } = await import('salvageunion-reference')
  return patchModelRows(SalvageUnionReference.CrawlerBays, MOCK_BAYS)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseCrawler: Crawler = {
  id: 'crawler-npc-1',
  schemaVersion: 1,
  name: 'Iron Tortoise',
  techLevel: 'tech-2',
  systems: [],
  currentSP: 20,
  crawlerBays: [
    {
      bayRef: 'command-bay',
      npcName: 'Dax Orsund',
      npcCurrentHP: 4,
      npcDescription: 'A stern veteran.',
      npcFacts: ['Hates synths'],
    },
    { bayRef: 'mech-bay', npcCurrentHP: 4 },
  ],
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
}

type Spies = {
  update: ReturnType<typeof mock>
  updateCrawlerBay: ReturnType<typeof mock>
}

function makeStubStore(crawler: Crawler, spies?: Partial<Spies>): typeof useEntityStore {
  const update = spies?.update ?? mock(async () => crawler)
  const updateCrawlerBay = spies?.updateCrawlerBay ?? mock(async () => crawler)
  return makeEntityStoreMock({
    crawlers: [crawler],
    hydrated: { pilots: false, mechs: false, crawlers: true, npcs: true, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [crawler]),
    get: mock((_type: string, id: string) => (id === crawler.id ? crawler : null)),
    create: mock(async () => crawler),
    update,
    updateCrawlerBay,
    delete: mock(async () => {}),
  })
}

// ---------------------------------------------------------------------------
// Crew identity (name, title, detail)
// ---------------------------------------------------------------------------

describe('CrawlerSheet — crew lead identity (CrewLeadMini)', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('renders name, SRD role title and detail', async () => {
    restore = await patchCrawlerBays()
    render(<CrawlerSheet crawler={baseCrawler} store={makeStubStore(baseCrawler)} readOnly />)
    expandCards()

    const inset = screen.getByLabelText('Command Bay crew lead')
    // The head: the role stamped before the crew's own name, HP live.
    const head = crewMini('Dax Orsund')
    expect(inset.contains(head)).toBe(true)
    expect(within(head as HTMLElement).getByText('Princeps')).toBeTruthy()
    // Its HP is the gauge beside its lines, never in the head.
    expect(head.textContent).not.toContain('HP')
    expect(within(inset).getByRole('img', { name: 'HP 4 of 4' })).toBeTruthy()
    // The body, under the head and outside it.
    const body = inset.querySelector('.su-entity-mini__body') as HTMLElement
    expect(within(body).getByText('A stern veteran.')).toBeTruthy()
    expect(within(body).getByText('Hates synths')).toBeTruthy()
  })

  test('no titled box nests in the bay: the crew lead is one contentful Mini (N3, N5)', async () => {
    restore = await patchCrawlerBays()
    for (const readOnly of [true, false]) {
      const { unmount } = render(
        <CrawlerSheet
          crawler={baseCrawler}
          store={makeStubStore(baseCrawler)}
          readOnly={readOnly}
        />
      )
      expandCards()
      const inset = screen.getByLabelText('Command Bay crew lead')
      expect(inset.querySelector('.su-box')).toBeNull()
      expect(inset.querySelectorAll('.su-entity-mini[data-contentful]')).toHaveLength(1)
      unmount()
    }
  })

  test('editing the name persists via the per-bay merge', async () => {
    restore = await patchCrawlerBays()
    const updateCrawlerBay = mock(async () => baseCrawler)
    render(
      <CrawlerSheet
        crawler={baseCrawler}
        store={makeStubStore(baseCrawler, { updateCrawlerBay })}
      />
    )
    expandCards()
    openCrewDetails()

    const field = screen.getByLabelText('Edit command bay crew name')
    await act(async () => {
      fireEvent.click(field)
    })
    const input = screen.getByLabelText('Edit command bay crew name')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Mara Vex' } })
      fireEvent.blur(input)
    })

    expect(updateCrawlerBay).toHaveBeenCalledWith(
      baseCrawler.id,
      'command-bay',
      { npcName: 'Mara Vex' },
      0,
      LIVE_SHEET_MANUAL
    )
  })

  test('editing the detail persists via the per-bay merge (no sibling clobber)', async () => {
    restore = await patchCrawlerBays()
    const updateCrawlerBay = mock(async () => baseCrawler)
    render(
      <CrawlerSheet
        crawler={baseCrawler}
        store={makeStubStore(baseCrawler, { updateCrawlerBay })}
      />
    )
    expandCards()
    openCrewDetails()

    const field = screen.getByLabelText('Edit command bay crew detail')
    await act(async () => {
      fireEvent.click(field)
    })
    const textarea = screen.getByLabelText('Edit command bay crew detail')
    await act(async () => {
      fireEvent.change(textarea, {
        target: { value: 'A grizzled commander.' },
      })
      fireEvent.blur(textarea)
    })

    expect(updateCrawlerBay).toHaveBeenCalledWith(
      baseCrawler.id,
      'command-bay',
      { npcDescription: 'A grizzled commander.' },
      0,
      LIVE_SHEET_MANUAL
    )
  })
})

// ---------------------------------------------------------------------------
// Crew HP (pip click-to-set, max 4)
// ---------------------------------------------------------------------------

describe('CrawlerSheet — crew HP editing (CrewLeadMini)', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('editing crew HP persists npcCurrentHP via the per-bay merge', async () => {
    restore = await patchCrawlerBays()
    const updateCrawlerBay = mock(async () => baseCrawler)
    render(
      <CrawlerSheet
        crawler={baseCrawler}
        store={makeStubStore(baseCrawler, { updateCrawlerBay })}
      />
    )
    expandCards()

    const inset = screen.getByLabelText('Command Bay crew lead')
    // Crew HP is the gauge beside its lines (starts full at 4/4, max 4); its
    // track steps by 1. Stepping down from 4 persists npcCurrentHP: 3.
    const gauge = within(inset).getByRole('slider', { name: 'HP' })
    await act(async () => {
      fireEvent.keyDown(gauge, { key: 'ArrowDown' })
    })

    expect(updateCrawlerBay).toHaveBeenCalledWith(
      baseCrawler.id,
      'command-bay',
      { npcCurrentHP: 3 },
      0,
      LIVE_SHEET_MANUAL
    )
  })

  test('readOnly renders the crew as a Mini, with no HP steppers', async () => {
    restore = await patchCrawlerBays()
    render(<CrawlerSheet crawler={baseCrawler} store={makeStubStore(baseCrawler)} readOnly />)
    expandCards()
    expect(screen.queryByRole('button', { name: 'Decrease HP' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Increase HP' })).toBeNull()
    // The Mini is named for the crew and Peeks the bay's NPC card.
    expect(crewMini('Dax Orsund').getAttribute('data-peek')).toBe('crawler-bays:command-bay/npc')
  })

  test('Edit puts the fields and the HP gauge in the Mini body', async () => {
    restore = await patchCrawlerBays()
    render(<CrawlerSheet crawler={baseCrawler} store={makeStubStore(baseCrawler)} />)
    const head = crewMini('Dax Orsund')
    // The name alone is the Peek trigger; the HP gauge is the body's.
    expect(head.querySelector('[data-peek]')?.getAttribute('data-peek')).toBe(
      'crawler-bays:command-bay/npc'
    )
    expect(head.querySelector('input, textarea')).toBeNull()
    expect(head.textContent).not.toContain('HP')
    openCrewDetails()
    const body = screen
      .getByLabelText('Command Bay crew lead')
      .querySelector('.su-entity-mini__body') as HTMLElement
    expect(within(body).getByRole('slider', { name: 'HP' })).toBeTruthy()
    for (const field of ['name', 'keepsake', 'motto', 'detail']) {
      expect(within(body).getByLabelText(`Edit command bay crew ${field}`)).toBeTruthy()
    }
    expect(within(body).queryByRole('button', { name: /HP$/ })).toBeNull()
    expect(within(body).getByLabelText('Add Command Bay crew fact')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Keepsake — persists through the SRD freeform 'Keepsake' choice (bayChoices)
// ---------------------------------------------------------------------------

describe('CrawlerSheet — crew keepsake via bayChoices', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('renders the persisted keepsake from bayChoices', async () => {
    restore = await patchCrawlerBays()
    const withKeepsake: Crawler = {
      ...baseCrawler,
      bayChoices: { 'command-bay': { [KEEPSAKE_CHOICE_ID]: ['A bent cog'] } },
    }
    render(<CrawlerSheet crawler={withKeepsake} store={makeStubStore(withKeepsake)} />)
    expandCards()
    const inset = screen.getByLabelText('Command Bay crew lead')
    expect(within(inset).getByText('A bent cog')).toBeTruthy()
  })

  test('editing the keepsake persists into bayChoices via store.update', async () => {
    restore = await patchCrawlerBays()
    const update = mock(async () => baseCrawler)
    render(<CrawlerSheet crawler={baseCrawler} store={makeStubStore(baseCrawler, { update })} />)
    expandCards()
    openCrewDetails()

    const field = screen.getByLabelText('Edit command bay crew keepsake')
    await act(async () => {
      fireEvent.click(field)
    })
    const input = screen.getByLabelText('Edit command bay crew keepsake')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'A bent cog' } })
      fireEvent.blur(input)
    })

    expect(update).toHaveBeenCalledWith(
      'crawler',
      baseCrawler.id,
      {
        bayChoices: { 'command-bay': { [KEEPSAKE_CHOICE_ID]: ['A bent cog'] } },
      },
      LIVE_SHEET_MANUAL
    )
  })

  test('a bay whose NPC has no Keepsake choice renders a read-only dash', async () => {
    restore = await patchCrawlerBays()
    render(<CrawlerSheet crawler={baseCrawler} store={makeStubStore(baseCrawler)} />)
    expandCards()
    // Mech Bay's mock npc carries no choices — keepsake cannot persist.
    expect(screen.queryByLabelText('Edit mech bay crew keepsake')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Motto — persists through the SRD freeform 'Motto' choice (bayChoices)
// ---------------------------------------------------------------------------

describe('CrawlerSheet — crew motto via bayChoices', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('renders the persisted motto from bayChoices', async () => {
    restore = await patchCrawlerBays()
    const withMotto: Crawler = {
      ...baseCrawler,
      bayChoices: { 'command-bay': { [MOTTO_CHOICE_ID]: ['No retreat'] } },
    }
    render(<CrawlerSheet crawler={withMotto} store={makeStubStore(withMotto)} />)
    expandCards()
    const inset = screen.getByLabelText('Command Bay crew lead')
    expect(within(inset).getByText('No retreat')).toBeTruthy()
  })

  test('editing the motto persists into bayChoices via store.update', async () => {
    restore = await patchCrawlerBays()
    const update = mock(async () => baseCrawler)
    render(<CrawlerSheet crawler={baseCrawler} store={makeStubStore(baseCrawler, { update })} />)
    expandCards()
    openCrewDetails()

    const field = screen.getByLabelText('Edit command bay crew motto')
    await act(async () => {
      fireEvent.click(field)
    })
    const input = screen.getByLabelText('Edit command bay crew motto')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'No retreat' } })
      fireEvent.blur(input)
    })

    expect(update).toHaveBeenCalledWith(
      'crawler',
      baseCrawler.id,
      {
        bayChoices: { 'command-bay': { [MOTTO_CHOICE_ID]: ['No retreat'] } },
      },
      LIVE_SHEET_MANUAL
    )
  })

  test('a bay whose NPC has no Motto choice renders a read-only dash', async () => {
    restore = await patchCrawlerBays()
    render(<CrawlerSheet crawler={baseCrawler} store={makeStubStore(baseCrawler)} />)
    expandCards()
    // Mech Bay's mock npc carries no choices — motto cannot persist.
    expect(screen.queryByLabelText('Edit mech bay crew motto')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

describe('CrawlerSheet — crew facts (CrewLeadMini)', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('adding a fact persists via the per-bay merge (no sibling clobber)', async () => {
    restore = await patchCrawlerBays()
    const updateCrawlerBay = mock(async () => baseCrawler)
    render(
      <CrawlerSheet
        crawler={baseCrawler}
        store={makeStubStore(baseCrawler, { updateCrawlerBay })}
      />
    )
    expandCards()
    openCrewDetails()

    const addBtn = screen.getByLabelText('Add Command Bay crew fact')
    await act(async () => {
      fireEvent.click(addBtn)
    })
    const input = screen.getByLabelText('New Command Bay crew fact')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Owes a debt' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(updateCrawlerBay).toHaveBeenCalledWith(
      baseCrawler.id,
      'command-bay',
      { npcFacts: ['Hates synths', 'Owes a debt'] },
      0,
      LIVE_SHEET_MANUAL
    )
  })

  test('removing a fact persists via the per-bay merge', async () => {
    restore = await patchCrawlerBays()
    const updateCrawlerBay = mock(async () => baseCrawler)
    render(
      <CrawlerSheet
        crawler={baseCrawler}
        store={makeStubStore(baseCrawler, { updateCrawlerBay })}
      />
    )
    expandCards()
    openCrewDetails()

    const removeBtn = screen.getByLabelText('Remove Command Bay crew fact Hates synths')
    await act(async () => {
      fireEvent.click(removeBtn)
    })

    expect(updateCrawlerBay).toHaveBeenCalledWith(
      baseCrawler.id,
      'command-bay',
      { npcFacts: [] },
      0,
      LIVE_SHEET_MANUAL
    )
  })
})

// ---------------------------------------------------------------------------
// readOnly
// ---------------------------------------------------------------------------

describe('CrawlerSheet — crew readOnly', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('shows values but exposes no edit controls; stores never called', async () => {
    restore = await patchCrawlerBays()
    const update = mock(async () => baseCrawler)
    const updateCrawlerBay = mock(async () => baseCrawler)
    render(
      <CrawlerSheet
        crawler={baseCrawler}
        store={makeStubStore(baseCrawler, { update, updateCrawlerBay })}
        readOnly
      />
    )
    expandCards()

    // Read draws the crew as its contentful Mini, the tracked values its body.
    expect(crewMini('Dax Orsund')).toBeTruthy()
    const inset = screen.getByLabelText('Command Bay crew lead')
    expect(within(inset).getByText('A stern veteran.')).toBeTruthy()
    expect(within(inset).getByText('Hates synths')).toBeTruthy()

    expect(screen.queryByLabelText('Edit command bay crew name')).toBeNull()
    expect(screen.queryByLabelText('Edit command bay crew detail')).toBeNull()
    expect(screen.queryByLabelText('Edit command bay crew keepsake')).toBeNull()
    expect(screen.queryByLabelText('Add Command Bay crew fact')).toBeNull()
    expect(screen.queryByLabelText('Remove Command Bay crew fact Hates synths')).toBeNull()

    expect(update).not.toHaveBeenCalled()
    expect(updateCrawlerBay).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Schema round-trip (snapshot path)
// ---------------------------------------------------------------------------

describe('CrawlerSchema — snapshot round-trip', () => {
  test('safeParse retains the crew fields on a crawlerBays entry', () => {
    const crawler: Crawler = {
      ...baseCrawler,
      crawlerBays: [
        {
          bayRef: 'command-bay',
          npcName: 'Dax Orsund',
          npcCurrentHP: 4,
          npcDescription: 'A stern veteran.',
          npcFacts: ['Hates synths', 'Owes a debt'],
          condition: 'damaged',
        },
      ],
    }
    const result = CrawlerSchema.safeParse(crawler)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.crawlerBays?.[0]).toEqual({
        bayRef: 'command-bay',
        npcName: 'Dax Orsund',
        npcCurrentHP: 4,
        npcDescription: 'A stern veteran.',
        npcFacts: ['Hates synths', 'Owes a debt'],
        condition: 'damaged',
      })
    }
  })
})
