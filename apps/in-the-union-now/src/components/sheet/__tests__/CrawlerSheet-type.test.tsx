/**
 * Crawler type card + special NPC tests (redesign phase 3: the type card
 * lives in the hero's CrawlerIdentityPanel now, not a body slab).
 *
 * When `crawler.type` is set, the identity panel renders the type's special
 * ability and the type itself as compact entity cards, with the special NPC
 * as an NpcInset in the type card's expand slot. Keepsake/Motto persist
 * through the type NPC's SRD freeform choices into bayChoices keyed by the
 * type ref; structured name/HP/description persist into the `typeNpc` field.
 *
 * Covers: type + ability card presence, the special NPC, the Augmented edge
 * (hitPoints:0 → no HP block), and untyped legacy crawlers (no cards, no
 * crash).
 *
 * Uses a patched Crawlers.all + the store-injection seam. NO mock.module().
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { CrawlerIdentityPanel } from '../CrawlerIdentity'
import { CrawlerSheet } from '../CrawlerSheet'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { useEntityStore } from '../../../stores/entityStore'

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Patched crawler-type catalog
// ---------------------------------------------------------------------------

const BATTLE_REF = 'battle-type'
const BATTLE_KEEPSAKE_ID = 'battle-keepsake-1'
const BATTLE_MOTTO_ID = 'battle-motto-1'

const AUGMENTED_REF = 'augmented-type'

const MOCK_TYPES = [
  {
    id: BATTLE_REF,
    name: 'Battle',
    schemaName: 'crawlers',
    actions: ['Improved Armour and Armaments'],
    content: [{ type: 'paragraph', value: 'Bristles with armour and armaments.' }],
    npc: {
      position: 'Grizzled Veteran',
      hitPoints: 10,
      choices: [
        { id: 'battle-name-1', name: 'Name', choiceType: 'freeform' },
        { id: BATTLE_KEEPSAKE_ID, name: 'Keepsake', choiceType: 'freeform' },
        { id: BATTLE_MOTTO_ID, name: 'Motto', choiceType: 'freeform' },
      ],
    },
  },
  {
    id: AUGMENTED_REF,
    name: 'Augmented',
    schemaName: 'crawlers',
    actions: ['Crawler Wide Augments'],
    content: [{ type: 'paragraph', value: 'Nearly everyone is augmented.' }],
    npc: {
      position: 'Union Crawler A.I.',
      hitPoints: 0,
      choices: [
        { id: 'aug-name-1', name: 'Name', choiceType: 'freeform' },
        { id: 'aug-desc-1', name: 'Description', choiceType: 'freeform' },
      ],
    },
  },
]

async function patchCrawlers(): Promise<() => void> {
  const { SalvageUnionReference } = await import('salvageunion-reference')
  const original = SalvageUnionReference.Crawlers.all.bind(SalvageUnionReference.Crawlers)
  SalvageUnionReference.Crawlers.all = mock(
    () => MOCK_TYPES as unknown as ReturnType<typeof SalvageUnionReference.Crawlers.all>
  )
  return () => {
    SalvageUnionReference.Crawlers.all = original
  }
}

// ---------------------------------------------------------------------------
// Store stub
// ---------------------------------------------------------------------------

function makeStubStore(crawler: Crawler, update?: ReturnType<typeof mock>): typeof useEntityStore {
  const updateMock = update ?? mock(async () => crawler)
  const storeState = {
    pilots: [],
    mechs: [],
    crawlers: [crawler],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: true, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [crawler]),
    get: mock((_t: string, id: string) => (id === crawler.id ? crawler : null)),
    create: mock(async () => crawler),
    update: updateMock,
    updateCrawlerBay: mock(async () => crawler),
    delete: mock(async () => {}),
  }
  return (() => storeState) as unknown as typeof useEntityStore
}

function makeCrawler(overrides?: Partial<Crawler>): Crawler {
  return {
    id: 'crawler-type-1',
    schemaVersion: 1,
    name: 'War Wagon',
    techLevel: 'tech-2',
    systems: [],
    currentSP: 20,
    crawlerBays: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/** Render the identity panel the way SheetCrawler does (store + storeState). */
function renderIdentity(crawler: Crawler, store: typeof useEntityStore) {
  return render(
    <CrawlerIdentityPanel crawler={crawler} store={store} storeState={store()} readOnly={false} />
  )
}

describe('CrawlerIdentityPanel — type + ability cards', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('renders the special-ability card, the type card and its special NPC', async () => {
    restore = await patchCrawlers()
    const crawler = makeCrawler({ type: BATTLE_REF, typeNpc: { npcName: 'Vex', npcCurrentHP: 8 } })
    renderIdentity(crawler, makeStubStore(crawler))

    // The type's special ability renders as its own compact entity card.
    expect(screen.getByText('Improved Armour and Armaments')).toBeTruthy()

    const inset = screen.getByLabelText('Battle crew lead')
    expect(within(inset).getByText('Vex')).toBeTruthy()
    expect(within(inset).getByText('Grizzled Veteran')).toBeTruthy()
  })

  test('renders the type NPC Keepsake/Motto from bayChoices keyed by the type ref', async () => {
    restore = await patchCrawlers()
    const crawler = makeCrawler({
      type: BATTLE_REF,
      typeNpc: { npcName: 'Vex' },
      bayChoices: {
        [BATTLE_REF]: { [BATTLE_KEEPSAKE_ID]: ['A dog tag'], [BATTLE_MOTTO_ID]: ['No retreat'] },
      },
    })
    renderIdentity(crawler, makeStubStore(crawler))

    const inset = screen.getByLabelText('Battle crew lead')
    expect(within(inset).getByText('A dog tag')).toBeTruthy()
    expect(within(inset).getByText('No retreat')).toBeTruthy()
  })

  test('editing the type NPC motto persists into bayChoices via store.update', async () => {
    restore = await patchCrawlers()
    const update = mock(async () => makeCrawler())
    const crawler = makeCrawler({ type: BATTLE_REF, typeNpc: { npcName: 'Vex' } })
    renderIdentity(crawler, makeStubStore(crawler, update))

    const field = screen.getByLabelText('Edit Battle crew motto')
    await act(async () => {
      fireEvent.click(field)
    })
    const input = screen.getByLabelText('Edit Battle crew motto')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'No retreat' } })
      fireEvent.blur(input)
    })

    expect(update).toHaveBeenCalledWith('crawler', crawler.id, {
      bayChoices: { [BATTLE_REF]: { [BATTLE_MOTTO_ID]: ['No retreat'] } },
    })
  })

  test('Augmented edge: hitPoints:0 NPC renders no HP block', async () => {
    restore = await patchCrawlers()
    const crawler = makeCrawler({ type: AUGMENTED_REF, typeNpc: { npcName: 'Oracle' } })
    renderIdentity(crawler, makeStubStore(crawler))

    const inset = screen.getByLabelText('Augmented crew lead')
    expect(within(inset).getByText('Oracle')).toBeTruthy()
    // No HP pips when maxHp is 0.
    expect(inset.querySelectorAll('[data-pip]').length).toBe(0)
    // Augmented's A.I. carries no Keepsake/Motto choice.
    expect(screen.queryByLabelText('Edit Augmented crew keepsake')).toBeNull()
    expect(screen.queryByLabelText('Edit Augmented crew motto')).toBeNull()
  })

  test('untyped legacy crawler: no type/ability cards, no crash', async () => {
    restore = await patchCrawlers()
    const crawler = makeCrawler() // no `type`
    renderIdentity(crawler, makeStubStore(crawler))

    expect(screen.queryByText('Improved Armour and Armaments')).toBeNull()
    expect(screen.queryByLabelText('Battle crew lead')).toBeNull()
    // The identity fields still render (Type shows its empty placeholder).
    expect(screen.getByText('War Wagon')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Editable tech level
// ---------------------------------------------------------------------------

describe('CrawlerSheet — editable tech level', () => {
  test('clicking a tech-level button writes techLevel via store.update', async () => {
    const update = mock(async () => makeCrawler())
    const crawler = makeCrawler({ techLevel: 'tech-2' })
    render(<CrawlerSheet crawler={crawler} store={makeStubStore(crawler, update)} />)

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Set tech level 4'))
    })
    expect(update).toHaveBeenCalledWith('crawler', crawler.id, { techLevel: 'tech-4' })
  })

  test('readOnly renders static tech-level text, no buttons', async () => {
    const update = mock(async () => makeCrawler())
    const crawler = makeCrawler({ techLevel: 'tech-3' })
    render(<CrawlerSheet crawler={crawler} store={makeStubStore(crawler, update)} readOnly />)

    expect(screen.getByText('Tech Level 3')).toBeTruthy()
    expect(screen.queryByLabelText('Set tech level 4')).toBeNull()
    expect(update).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Schema legacy tolerance
// ---------------------------------------------------------------------------

describe('CrawlerSchema — type/typeNpc legacy tolerance', () => {
  test('a legacy crawler (no type/typeNpc) still validates', async () => {
    const { CrawlerSchema } = await import('../../../lib/schemas/crawler')
    const legacy = makeCrawler({ techLevel: 'tech-3' })
    const result = CrawlerSchema.safeParse(legacy)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBeUndefined()
      expect(result.data.typeNpc).toBeUndefined()
    }
  })

  test('round-trips type + typeNpc when present', async () => {
    const { CrawlerSchema } = await import('../../../lib/schemas/crawler')
    const typed = makeCrawler({
      type: BATTLE_REF,
      typeNpc: { npcName: 'Vex', npcCurrentHP: 8, condition: 'intact' },
    })
    const result = CrawlerSchema.safeParse(typed)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe(BATTLE_REF)
      expect(result.data.typeNpc).toEqual({ npcName: 'Vex', npcCurrentHP: 8, condition: 'intact' })
    }
  })
})
