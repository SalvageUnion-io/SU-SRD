import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  crawlerWizardToCreateInput,
  extractBayNpcs,
  computeCrawlerStatsFromTechLevel,
  computeScrapTranslation,
  getWeaponSlotCount,
  canSubmitCrawlerWizard,
} from './crawlerUtils'
import type { WizardState } from './pilotUtils'
import type { SURefObjectGuideStep } from 'salvageunion-reference'

const makeCrawlerSteps = (): SURefObjectGuideStep[] =>
  [
    {
      id: 'step-crawler-type',
      name: 'Choose a Crawler Type',
      stepType: 'select-one',
      schema: ['crawlers'],
    },
    {
      id: 'step-weapon',
      name: 'Choose Weapons Systems',
      stepType: 'select-many',
      schema: ['systems'],
      dependsOn: ['step-crawler-type'],
      constraints: { min: 1 },
    },
    {
      id: 'step-npcs',
      name: "Name the Crawler's NPCs",
      stepType: 'freeform',
      schema: ['crawler-bays'],
    },
    {
      id: 'step-name',
      name: 'Give your Crawler a Name and Number',
      stepType: 'roll-table',
      rollTable: 'Crawler Name',
    },
  ] as SURefObjectGuideStep[]

describe('crawlerWizardToCreateInput', () => {
  test('returns null when no crawler type selected', () => {
    const state: WizardState = { selections: {}, currentStepIndex: 0 }
    expect(crawlerWizardToCreateInput(state, makeCrawlerSteps())).toBeNull()
  })

  test('returns input with crawler_ref when type is selected', () => {
    const state: WizardState = {
      selections: {
        'step-crawler-type': { selectedIds: ['crawler-id-1'], schemaName: 'crawlers' },
      },
      currentStepIndex: 1,
    }
    const result = crawlerWizardToCreateInput(state, makeCrawlerSteps())
    expect(result).not.toBeNull()
    expect(result!.crawler_ref).toBe('crawler-id-1')
  })

  test('includes weapon_refs when weapons are selected', () => {
    const state: WizardState = {
      selections: {
        'step-crawler-type': { selectedIds: ['crawler-id-1'], schemaName: 'crawlers' },
        'step-weapon': { selectedIds: ['weapon-id-1', 'weapon-id-2'], schemaName: 'systems' },
      },
      currentStepIndex: 2,
    }
    const result = crawlerWizardToCreateInput(state, makeCrawlerSteps())
    expect(result!.weapon_refs).toEqual([
      { schema_name: 'systems', schema_ref_id: 'weapon-id-1' },
      { schema_name: 'systems', schema_ref_id: 'weapon-id-2' },
    ])
    // weapon_ref still set for backwards compat
    expect(result!.weapon_ref).toEqual({
      schema_name: 'systems',
      schema_ref_id: 'weapon-id-1',
    })
  })

  test('parses name from text', () => {
    const state: WizardState = {
      selections: {
        'step-crawler-type': { selectedIds: ['crawler-id-1'], schemaName: 'crawlers' },
        'step-name': { selectedIds: [], textValue: 'Tin Lizzy' },
      },
      currentStepIndex: 3,
    }
    const result = crawlerWizardToCreateInput(state, makeCrawlerSteps())
    expect(result!.name).toBe('Tin Lizzy')
    expect(result!.tag).toBeUndefined()
  })

  test('parses name and tag from text with #number', () => {
    const state: WizardState = {
      selections: {
        'step-crawler-type': { selectedIds: ['crawler-id-1'], schemaName: 'crawlers' },
        'step-name': { selectedIds: [], textValue: '#132 - Tin Lizzy' },
      },
      currentStepIndex: 3,
    }
    const result = crawlerWizardToCreateInput(state, makeCrawlerSteps())
    expect(result!.name).toBe('Tin Lizzy')
    expect(result!.tag).toBe('132')
  })
})

describe('extractBayNpcs', () => {
  // Command Bay NPC (Princeps) choice IDs from reference data
  const commandBay = SalvageUnionReference.CrawlerBays.find((b) => b.name === 'Command Bay')!
  const commandNpcChoices = commandBay.npc!.choices!
  const commandNameChoiceId = commandNpcChoices.find((c) => c.name === 'Name')!.id
  const commandKeepsakeChoiceId = commandNpcChoices.find((c) => c.name === 'Keepsake')!.id
  const commandMottoChoiceId = commandNpcChoices.find((c) => c.name === 'Motto')!.id

  test('maps choice values to bay NPC data', () => {
    const result = extractBayNpcs({
      [commandNameChoiceId]: 'Captain Rex',
      [commandKeepsakeChoiceId]: 'Old compass',
      [commandMottoChoiceId]: 'Forward always',
    })

    expect(result[commandBay.id]).toEqual({
      name: 'Captain Rex',
      keepsake: 'Old compass',
      motto: 'Forward always',
    })
  })

  test('returns empty object for empty choiceValues', () => {
    expect(extractBayNpcs({})).toEqual({})
  })

  test('skips empty/whitespace-only values', () => {
    const result = extractBayNpcs({
      [commandNameChoiceId]: 'Captain Rex',
      [commandKeepsakeChoiceId]: '   ',
      [commandMottoChoiceId]: '',
    })

    expect(result[commandBay.id]).toEqual({ name: 'Captain Rex' })
  })

  test('includes crawler type NPC when provided', () => {
    const battleCrawler = SalvageUnionReference.Crawlers.find((c) => c.name === 'Battle')!
    const crawlerNpcChoices = battleCrawler.npc!.choices!
    const crawlerNameChoiceId = crawlerNpcChoices.find((c) => c.name === 'Name')!.id

    const result = extractBayNpcs(
      {
        [crawlerNameChoiceId]: 'Sarge',
        [commandNameChoiceId]: 'Captain Rex',
      },
      battleCrawler.id
    )

    expect(result[battleCrawler.id]).toEqual({ name: 'Sarge' })
    expect(result[commandBay.id]).toEqual({ name: 'Captain Rex' })
  })

  test('handles partial filling across multiple bays', () => {
    const mechBay = SalvageUnionReference.CrawlerBays.find((b) => b.name === 'Mech Bay')!
    const mechNpcChoices = mechBay.npc!.choices!
    const mechNameChoiceId = mechNpcChoices.find((c) => c.name === 'Name')!.id

    const result = extractBayNpcs({
      [commandNameChoiceId]: 'Captain Rex',
      [mechNameChoiceId]: 'Wrench',
    })

    expect(result[commandBay.id]).toEqual({ name: 'Captain Rex' })
    expect(result[mechBay.id]).toEqual({ name: 'Wrench' })
  })
})

describe('crawlerWizardToCreateInput with bay_npcs', () => {
  const commandBay = SalvageUnionReference.CrawlerBays.find((b) => b.name === 'Command Bay')!
  const commandNameChoiceId = commandBay.npc!.choices!.find((c) => c.name === 'Name')!.id
  const battleCrawler = SalvageUnionReference.Crawlers.find((c) => c.name === 'Battle')!

  test('includes bay_npcs from choiceValues', () => {
    const state: WizardState = {
      selections: {
        'step-crawler-type': { selectedIds: [battleCrawler.id], schemaName: 'crawlers' },
        'step-npcs': {
          selectedIds: [],
          choiceValues: { [commandNameChoiceId]: 'Captain Rex' },
        },
      },
      currentStepIndex: 3,
    }
    const result = crawlerWizardToCreateInput(state, makeCrawlerSteps())
    expect(result).not.toBeNull()
    expect(result!.bay_npcs).toBeDefined()
    expect(result!.bay_npcs![commandBay.id]).toEqual({ name: 'Captain Rex' })
  })

  test('omits bay_npcs when no choiceValues', () => {
    const state: WizardState = {
      selections: {
        'step-crawler-type': { selectedIds: [battleCrawler.id], schemaName: 'crawlers' },
      },
      currentStepIndex: 1,
    }
    const result = crawlerWizardToCreateInput(state, makeCrawlerSteps())
    expect(result!.bay_npcs).toBeUndefined()
  })
})

describe('computeCrawlerStatsFromTechLevel', () => {
  const battleCrawlerId = SalvageUnionReference.Crawlers.find((c) => c.name === 'Battle')!.id
  const engineeringCrawlerId = SalvageUnionReference.Crawlers.find(
    (c) => c.name === 'Engineering'
  )!.id

  test('returns TL1 stats', () => {
    const stats = computeCrawlerStatsFromTechLevel(1)
    expect(stats.max_sp).toBe(20)
    expect(stats.upkeep).toBe(5)
    expect(stats.upgrade_cost).toBe(30)
  })

  test('returns TL6 stats with null upgrade cost', () => {
    const stats = computeCrawlerStatsFromTechLevel(6)
    expect(stats.max_sp).toBe(50)
    expect(stats.upgrade_cost).toBeNull()
  })

  test('adds SP bonus for Battle crawler', () => {
    const stats = computeCrawlerStatsFromTechLevel(1, battleCrawlerId)
    expect(stats.max_sp).toBe(25) // 20 base + 5 bonus
  })

  test('no SP bonus for Engineering crawler', () => {
    const stats = computeCrawlerStatsFromTechLevel(1, engineeringCrawlerId)
    expect(stats.max_sp).toBe(20)
  })
})

describe('getWeaponSlotCount (re-exported)', () => {
  const battleCrawlerId = SalvageUnionReference.Crawlers.find((c) => c.name === 'Battle')!.id
  const engineeringCrawlerId = SalvageUnionReference.Crawlers.find(
    (c) => c.name === 'Engineering'
  )!.id

  test('Battle crawler has 2 weapon slots', () => {
    expect(getWeaponSlotCount(battleCrawlerId)).toBe(2)
  })

  test('Engineering crawler has 1 weapon slot', () => {
    expect(getWeaponSlotCount(engineeringCrawlerId)).toBe(1)
  })
})

describe('computeScrapTranslation', () => {
  test('consolidate: 3 TL1 → 1 TL3', () => {
    const result = computeScrapTranslation(1, 3, 3)
    expect(result).toEqual({ targetAmount: 1, sourceConsumed: 3 })
  })

  test('consolidate: 6 TL1 → 3 TL2', () => {
    const result = computeScrapTranslation(1, 2, 6)
    expect(result).toEqual({ targetAmount: 3, sourceConsumed: 6 })
  })

  test('break down: 1 TL3 → 3 TL1', () => {
    const result = computeScrapTranslation(3, 1, 1)
    expect(result).toEqual({ targetAmount: 3, sourceConsumed: 1 })
  })

  test('break down: 2 TL3 → 3 TL2', () => {
    const result = computeScrapTranslation(3, 2, 2)
    expect(result).toEqual({ targetAmount: 3, sourceConsumed: 2 })
  })

  test('cross-conversion: 2 TL2 → 1 TL4', () => {
    const result = computeScrapTranslation(2, 4, 2)
    expect(result).toEqual({ targetAmount: 1, sourceConsumed: 2 })
  })

  test('returns null if insufficient source', () => {
    expect(computeScrapTranslation(1, 3, 2)).toBeNull()
  })

  test('returns null for same TL', () => {
    expect(computeScrapTranslation(2, 2, 5)).toBeNull()
  })

  test('returns null for zero amount', () => {
    expect(computeScrapTranslation(1, 2, 0)).toBeNull()
  })

  test('returns null for out-of-range TL', () => {
    expect(computeScrapTranslation(0, 2, 5)).toBeNull()
    expect(computeScrapTranslation(1, 7, 5)).toBeNull()
  })

  test('partial consumption: 5 TL1 → 2 TL2 (1 leftover)', () => {
    const result = computeScrapTranslation(1, 2, 5)
    expect(result).toEqual({ targetAmount: 2, sourceConsumed: 4 })
  })
})

// ---------------------------------------------------------------------------
// canSubmitCrawlerWizard — Battle needs 2 weapons, others need 1
// ---------------------------------------------------------------------------

describe('canSubmitCrawlerWizard', () => {
  const battleCrawler = SalvageUnionReference.Crawlers.find((c) => c.name === 'Battle')!
  const engineeringCrawler = SalvageUnionReference.Crawlers.find((c) => c.name === 'Engineering')!

  /** Steps with the NPC step marked optional to isolate weapon slot testing */
  const weaponTestSteps: SURefObjectGuideStep[] = [
    {
      id: 'step-crawler-type',
      name: 'Choose a Crawler Type',
      stepType: 'select-one',
      schema: ['crawlers'],
    },
    {
      id: 'step-weapon',
      name: 'Choose Weapons Systems',
      stepType: 'select-many',
      schema: ['systems'],
      dependsOn: ['step-crawler-type'],
      constraints: { min: 1 },
    },
    {
      id: 'step-npcs',
      name: "Name the Crawler's NPCs",
      stepType: 'freeform',
      schema: ['crawler-bays'],
      optional: true,
    },
    {
      id: 'step-name',
      name: 'Give your Crawler a Name and Number',
      stepType: 'roll-table',
      rollTable: 'Crawler Name',
    },
  ] as SURefObjectGuideStep[]

  /** Build a "complete" wizard state with all steps filled */
  const makeCompleteState = (crawlerId: string, weaponIds: string[]): WizardState => ({
    selections: {
      'step-crawler-type': { selectedIds: [crawlerId], schemaName: 'crawlers' },
      'step-weapon': { selectedIds: weaponIds, schemaName: 'systems' },
      'step-name': { selectedIds: [], textValue: 'Test Crawler' },
    },
    currentStepIndex: 3,
  })

  test('Battle with 1 weapon cannot submit (needs 2)', () => {
    const state = makeCompleteState(battleCrawler.id, ['weapon-a'])
    expect(canSubmitCrawlerWizard(state, weaponTestSteps)).toBe(false)
  })

  test('Battle with 2 weapons can submit', () => {
    const state = makeCompleteState(battleCrawler.id, ['weapon-a', 'weapon-b'])
    expect(canSubmitCrawlerWizard(state, weaponTestSteps)).toBe(true)
  })

  test('Battle with 3 weapons cannot submit (exceeds max)', () => {
    const state = makeCompleteState(battleCrawler.id, ['weapon-a', 'weapon-b', 'weapon-c'])
    expect(canSubmitCrawlerWizard(state, weaponTestSteps)).toBe(false)
  })

  test('Engineering with 1 weapon can submit', () => {
    const state = makeCompleteState(engineeringCrawler.id, ['weapon-a'])
    expect(canSubmitCrawlerWizard(state, weaponTestSteps)).toBe(true)
  })

  test('Engineering with 0 weapons cannot submit', () => {
    const state = makeCompleteState(engineeringCrawler.id, [])
    expect(canSubmitCrawlerWizard(state, weaponTestSteps)).toBe(false)
  })

  test('Engineering with 2 weapons cannot submit (exceeds max)', () => {
    const state = makeCompleteState(engineeringCrawler.id, ['weapon-a', 'weapon-b'])
    expect(canSubmitCrawlerWizard(state, weaponTestSteps)).toBe(false)
  })
})
