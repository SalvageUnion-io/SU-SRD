/**
 * CrawlerSheet — per-bay crew lead (NpcInset) tests (plan 4.6, design §4.4).
 *
 * Each bay card's `expand` slot renders the crew lead as an NpcInset with
 * editable name / HP (max 4) / keepsake / detail / facts (rules C11).
 *
 * Asserts that:
 *   1. Name, detail (description) and facts persist via the store-level
 *      per-bay merge (updateCrawlerBay), without clobbering sibling bays.
 *   2. HP pip click-to-set persists npcCurrentHP via the per-bay merge.
 *   3. Keepsake persists through the bay NPC's SRD freeform 'Keepsake' choice
 *      into the crawler's bayChoices map (store.update).
 *   4. The SRD role title (npc.position) renders read-only.
 *   5. readOnly shows values but exposes no edit controls.
 *   6. CrawlerSchema round-trips the bay entry fields (snapshot path).
 *
 * Uses the store-injection seam + a patched CrawlerBays.all. NO mock.module().
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { CrawlerSheet } from '../CrawlerSheet'
import { CrawlerSchema } from '../../../lib/schemas/crawler'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { useEntityStore } from '../../../stores/entityStore'
import { must } from '../../__tests__/must'

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// SalvageUnionReference.CrawlerBays.all patch (so bays resolve in the sheet)
// ---------------------------------------------------------------------------

const KEEPSAKE_CHOICE_ID = 'command-bay-keepsake-1'
const MOTTO_CHOICE_ID = 'command-bay-motto-1'

const MOCK_BAYS = [
  {
    id: 'command-bay',
    name: 'Command Bay',
    schemaName: 'crawler-bays',
    npc: {
      position: 'Princeps',
      hitPoints: 4,
      choices: [
        { id: 'command-bay-name-1', name: 'Name', choiceType: 'freeform' },
        { id: KEEPSAKE_CHOICE_ID, name: 'Keepsake', choiceType: 'freeform' },
        { id: MOTTO_CHOICE_ID, name: 'Motto', choiceType: 'freeform' },
      ],
    },
  },
  {
    id: 'mech-bay',
    name: 'Mech Bay',
    schemaName: 'crawler-bays',
    npc: { position: 'Greaser', hitPoints: 4 },
  },
]

async function patchCrawlerBays(): Promise<() => void> {
  const { SalvageUnionReference } = await import('salvageunion-reference')
  const original = SalvageUnionReference.CrawlerBays.all.bind(SalvageUnionReference.CrawlerBays)
  SalvageUnionReference.CrawlerBays.all = mock(
    () => MOCK_BAYS as unknown as ReturnType<typeof SalvageUnionReference.CrawlerBays.all>
  )
  return () => {
    SalvageUnionReference.CrawlerBays.all = original
  }
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
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

type Spies = {
  update: ReturnType<typeof mock>
  updateCrawlerBay: ReturnType<typeof mock>
}

function makeStubStore(crawler: Crawler, spies?: Partial<Spies>): typeof useEntityStore {
  const update = spies?.update ?? mock(async () => crawler)
  const updateCrawlerBay = spies?.updateCrawlerBay ?? mock(async () => crawler)
  const storeState = {
    pilots: [],
    mechs: [],
    crawlers: [crawler],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: true, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [crawler]),
    get: mock((_type: string, id: string) => (id === crawler.id ? crawler : null)),
    create: mock(async () => crawler),
    update,
    updateCrawlerBay,
    delete: mock(async () => {}),
  }
  return (() => storeState) as unknown as typeof useEntityStore
}

// ---------------------------------------------------------------------------
// Crew identity (name, title, detail)
// ---------------------------------------------------------------------------

describe('CrawlerSheet — crew lead identity (NpcInset)', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('renders name, SRD role title and detail', async () => {
    restore = await patchCrawlerBays()
    render(<CrawlerSheet crawler={baseCrawler} store={makeStubStore(baseCrawler)} />)

    const inset = screen.getByLabelText('Command Bay crew lead')
    expect(within(inset).getByText('Dax Orsund')).toBeTruthy()
    expect(within(inset).getByText('Princeps')).toBeTruthy()
    expect(within(inset).getByText('A stern veteran.')).toBeTruthy()
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

    const field = screen.getByLabelText('Edit Command Bay crew name')
    await act(async () => {
      fireEvent.click(field)
    })
    const input = screen.getByLabelText('Edit Command Bay crew name')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Mara Vex' } })
      fireEvent.blur(input)
    })

    expect(updateCrawlerBay).toHaveBeenCalledWith(
      baseCrawler.id,
      'command-bay',
      { npcName: 'Mara Vex' },
      0
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

    const field = screen.getByLabelText('Edit Command Bay crew detail')
    await act(async () => {
      fireEvent.click(field)
    })
    const textarea = screen.getByLabelText('Edit Command Bay crew detail')
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
      0
    )
  })
})

// ---------------------------------------------------------------------------
// Crew HP (pip click-to-set, max 4)
// ---------------------------------------------------------------------------

describe('CrawlerSheet — crew HP editing (NpcInset)', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('clicking an HP pip persists npcCurrentHP via the per-bay merge', async () => {
    restore = await patchCrawlerBays()
    const updateCrawlerBay = mock(async () => baseCrawler)
    render(
      <CrawlerSheet
        crawler={baseCrawler}
        store={makeStubStore(baseCrawler, { updateCrawlerBay })}
      />
    )

    const inset = screen.getByLabelText('Command Bay crew lead')
    const pips = inset.querySelectorAll('button[data-pip]')
    expect(pips.length).toBe(4)
    // Clicking lit pip index 1 (value 4) sets HP to 1 (§4.5 click-to-set).
    await act(async () => {
      fireEvent.click(must(pips[1]))
    })

    expect(updateCrawlerBay).toHaveBeenCalledWith(
      baseCrawler.id,
      'command-bay',
      { npcCurrentHP: 1 },
      0
    )
  })

  test('readOnly renders HP pips as plain spans (no buttons)', async () => {
    restore = await patchCrawlerBays()
    render(<CrawlerSheet crawler={baseCrawler} store={makeStubStore(baseCrawler)} readOnly />)
    const inset = screen.getByLabelText('Command Bay crew lead')
    expect(inset.querySelectorAll('button[data-pip]').length).toBe(0)
    expect(inset.querySelectorAll('[data-pip]').length).toBe(4)
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
    const inset = screen.getByLabelText('Command Bay crew lead')
    expect(within(inset).getByText('A bent cog')).toBeTruthy()
  })

  test('editing the keepsake persists into bayChoices via store.update', async () => {
    restore = await patchCrawlerBays()
    const update = mock(async () => baseCrawler)
    render(<CrawlerSheet crawler={baseCrawler} store={makeStubStore(baseCrawler, { update })} />)

    const field = screen.getByLabelText('Edit Command Bay crew keepsake')
    await act(async () => {
      fireEvent.click(field)
    })
    const input = screen.getByLabelText('Edit Command Bay crew keepsake')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'A bent cog' } })
      fireEvent.blur(input)
    })

    expect(update).toHaveBeenCalledWith('crawler', baseCrawler.id, {
      bayChoices: { 'command-bay': { [KEEPSAKE_CHOICE_ID]: ['A bent cog'] } },
    })
  })

  test('a bay whose NPC has no Keepsake choice renders a read-only dash', async () => {
    restore = await patchCrawlerBays()
    render(<CrawlerSheet crawler={baseCrawler} store={makeStubStore(baseCrawler)} />)
    // Mech Bay's mock npc carries no choices — keepsake cannot persist.
    expect(screen.queryByLabelText('Edit Mech Bay crew keepsake')).toBeNull()
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
    const inset = screen.getByLabelText('Command Bay crew lead')
    expect(within(inset).getByText('No retreat')).toBeTruthy()
  })

  test('editing the motto persists into bayChoices via store.update', async () => {
    restore = await patchCrawlerBays()
    const update = mock(async () => baseCrawler)
    render(<CrawlerSheet crawler={baseCrawler} store={makeStubStore(baseCrawler, { update })} />)

    const field = screen.getByLabelText('Edit Command Bay crew motto')
    await act(async () => {
      fireEvent.click(field)
    })
    const input = screen.getByLabelText('Edit Command Bay crew motto')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'No retreat' } })
      fireEvent.blur(input)
    })

    expect(update).toHaveBeenCalledWith('crawler', baseCrawler.id, {
      bayChoices: { 'command-bay': { [MOTTO_CHOICE_ID]: ['No retreat'] } },
    })
  })

  test('a bay whose NPC has no Motto choice renders a read-only dash', async () => {
    restore = await patchCrawlerBays()
    render(<CrawlerSheet crawler={baseCrawler} store={makeStubStore(baseCrawler)} />)
    // Mech Bay's mock npc carries no choices — motto cannot persist.
    expect(screen.queryByLabelText('Edit Mech Bay crew motto')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

describe('CrawlerSheet — crew facts (NpcInset)', () => {
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
      0
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

    const removeBtn = screen.getByLabelText('Remove Command Bay crew fact Hates synths')
    await act(async () => {
      fireEvent.click(removeBtn)
    })

    expect(updateCrawlerBay).toHaveBeenCalledWith(
      baseCrawler.id,
      'command-bay',
      { npcFacts: [] },
      0
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

    const inset = screen.getByLabelText('Command Bay crew lead')
    expect(within(inset).getByText('Dax Orsund')).toBeTruthy()
    expect(within(inset).getByText('A stern veteran.')).toBeTruthy()
    expect(within(inset).getByText('Hates synths')).toBeTruthy()

    expect(screen.queryByLabelText('Edit Command Bay crew name')).toBeNull()
    expect(screen.queryByLabelText('Edit Command Bay crew detail')).toBeNull()
    expect(screen.queryByLabelText('Edit Command Bay crew keepsake')).toBeNull()
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
