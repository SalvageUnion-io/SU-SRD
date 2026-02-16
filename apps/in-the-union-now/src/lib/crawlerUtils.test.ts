import { describe, expect, test } from 'bun:test'
import {
  crawlerWizardToCreateInput,
  computeCrawlerStatsFromTechLevel,
  computeScrapTranslation,
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
      name: 'Choose a Weapons System',
      stepType: 'select-one',
      schema: ['systems'],
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

  test('includes weapon_ref when weapon is selected', () => {
    const state: WizardState = {
      selections: {
        'step-crawler-type': { selectedIds: ['crawler-id-1'], schemaName: 'crawlers' },
        'step-weapon': { selectedIds: ['weapon-id-1'], schemaName: 'systems' },
      },
      currentStepIndex: 2,
    }
    const result = crawlerWizardToCreateInput(state, makeCrawlerSteps())
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

describe('computeCrawlerStatsFromTechLevel', () => {
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
