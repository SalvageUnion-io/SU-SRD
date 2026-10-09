/** Unit tests for the crawler wizard form-state mappers (plan 3.1). */
import { describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { CrawlerSchema } from '../../schemas/crawler'
import {
  crawlerFormCrewToPatches,
  crawlerFormToCreateInput,
  crawlerFormToUpdatePatch,
  EMPTY_CRAWLER_FORM_STATE,
  EMPTY_SCRAP_POOL,
  seedDefaultCrawlerBays,
  toScrapPoolPatch,
} from '../crawlerFormState'

/** Narrow an SRD lookup that the fixtures guarantee exists. */
function defined<T>(value: T | null | undefined, label: string): T {
  if (value == null) throw new Error(`Expected ${label} to be defined`)
  return value
}

// Real Battle crawler type + its special NPC's freeform choice ids.
const BATTLE_TYPE_ID = '3d1d9f79-9c56-43fa-a4c9-6dfe10b9aac9'
const BATTLE_KEEPSAKE_ID = '94e8204d-652c-47f4-93ca-271cebb16459'
const BATTLE_MOTTO_ID = 'b103d074-5b3c-40af-99ee-805c92814199'

describe('toScrapPoolPatch', () => {
  it('strips zero buckets and keeps positive ones', () => {
    expect(toScrapPoolPatch({ ...EMPTY_SCRAP_POOL, tl1: 2, tl6: 1 })).toEqual({
      tl1: 2,
      tl6: 1,
    })
  })

  it('returns an empty object when all buckets are zero', () => {
    expect(toScrapPoolPatch(EMPTY_SCRAP_POOL)).toEqual({})
  })
})

describe('crawlerFormToUpdatePatch', () => {
  it('adds the chosen type to the patch (and nothing else from crew/NPC state)', () => {
    const patch = crawlerFormToUpdatePatch({
      ...EMPTY_CRAWLER_FORM_STATE,
      name: 'Bay Wagon',
      techLevel: 1,
      type: 'battle-type-id',
      crew: { 'some-bay': { name: 'Vex', keepsake: 'A cog' } },
    })
    expect(Object.keys(patch).sort()).toEqual([
      'description',
      'name',
      'scrapPool',
      'systems',
      'techLevel',
      'type',
      'upgradePool',
    ])
    expect(patch.type).toBe('battle-type-id')
  })

  it('throws when no tech level is chosen', () => {
    expect(() =>
      crawlerFormToUpdatePatch({ ...EMPTY_CRAWLER_FORM_STATE, techLevel: null })
    ).toThrow(/tech level/i)
  })

  it('trims the name', () => {
    const patch = crawlerFormToUpdatePatch({
      ...EMPTY_CRAWLER_FORM_STATE,
      name: '  Bay Wagon  ',
      techLevel: 1,
    })
    expect(patch.name).toBe('Bay Wagon')
  })
})

describe('crawlerFormToCreateInput', () => {
  it('builds a CrawlerSchema-valid payload with seeded bays and full SP', () => {
    const input = crawlerFormToCreateInput(
      {
        ...EMPTY_CRAWLER_FORM_STATE,
        name: 'Bay Wagon',
        techLevel: 1,
        scrapPool: { ...EMPTY_SCRAP_POOL, tl1: 3 },
        upgradePool: 12,
      },
      {
        maxSP: 20,
        crawlerBays: [{ bayRef: 'command-bay', npcCurrentHP: 4 }],
      }
    )
    expect(input.schemaVersion).toBe(1)
    expect(input.techLevel).toBe('tech-1')
    expect(input.crawlerBays).toEqual([{ bayRef: 'command-bay', npcCurrentHP: 4 }])
    expect(input.currentSP).toBe(20)
    expect(input.scrapPool).toEqual({ tl1: 3 })
    expect(input.upgradePool).toBe(12)

    const parsed = CrawlerSchema.safeParse({
      ...input,
      id: 'temp',
      createdAt: FIXTURE_NOW,
      updatedAt: FIXTURE_NOW,
    })
    expect(parsed.success).toBe(true)
  })

  it('omits currentSP when the tech level has no known SP', () => {
    const input = crawlerFormToCreateInput(
      { ...EMPTY_CRAWLER_FORM_STATE, name: 'X', techLevel: 2 },
      { crawlerBays: [] }
    )
    expect('currentSP' in input).toBe(false)
  })

  it('folds the crew + type NPC into bays, bayChoices and typeNpc', () => {
    const commandBay = defined(
      SalvageUnionReference.CrawlerBays.getByName('Command Bay'),
      'Command Bay'
    )
    const battle = defined(
      SalvageUnionReference.Crawlers.getById(BATTLE_TYPE_ID),
      'Battle crawler type'
    )
    const input = crawlerFormToCreateInput(
      {
        ...EMPTY_CRAWLER_FORM_STATE,
        name: 'War Wagon',
        techLevel: 1,
        type: BATTLE_TYPE_ID,
        crew: {
          [commandBay.id]: { name: 'Maddox', description: 'Stern', keepsake: 'A medal' },
          [BATTLE_TYPE_ID]: { name: 'Vex', keepsake: 'A dog tag', motto: 'No retreat' },
        },
      },
      { maxSP: 20, crawlerBays: seedDefaultCrawlerBays() }
    )

    // Bay structured state folded in; Keepsake routed to bayChoices.
    const seededCommand = input.crawlerBays.find((e) => e.bayRef === commandBay.id)
    expect(seededCommand?.npcName).toBe('Maddox')
    expect(seededCommand?.npcDescription).toBe('Stern')
    const commandKeepsakeId = defined(
      commandBay.npc?.choices?.find((c) => c.name === 'Keepsake'),
      'Command Bay Keepsake choice'
    ).id
    expect(input.bayChoices?.[commandBay.id]?.[commandKeepsakeId]).toEqual(['A medal'])

    // Type NPC: structured name + HP from the SRD npc, Keepsake/Motto in bayChoices.
    expect(input.typeNpc?.npcName).toBe('Vex')
    expect(input.typeNpc?.npcCurrentHP).toBe(defined(battle.npc, 'battle npc').hitPoints)
    expect(input.bayChoices?.[BATTLE_TYPE_ID]?.[BATTLE_KEEPSAKE_ID]).toEqual(['A dog tag'])
    expect(input.bayChoices?.[BATTLE_TYPE_ID]?.[BATTLE_MOTTO_ID]).toEqual(['No retreat'])

    const parsed = CrawlerSchema.safeParse({
      ...input,
      id: 'temp',
      createdAt: FIXTURE_NOW,
      updatedAt: FIXTURE_NOW,
    })
    expect(parsed.success).toBe(true)
  })
})

describe('crawlerFormCrewToPatches', () => {
  it('splits crew into bay patches, bayChoices and a typeNpc patch', () => {
    const commandBay = defined(
      SalvageUnionReference.CrawlerBays.getByName('Command Bay'),
      'Command Bay'
    )
    const commandKeepsakeId = defined(
      commandBay.npc?.choices?.find((c) => c.name === 'Keepsake'),
      'Command Bay Keepsake choice'
    ).id
    const patches = crawlerFormCrewToPatches({
      ...EMPTY_CRAWLER_FORM_STATE,
      name: 'War Wagon',
      techLevel: 1,
      type: BATTLE_TYPE_ID,
      crew: {
        [commandBay.id]: { name: 'Maddox', keepsake: 'A medal' },
        [BATTLE_TYPE_ID]: { name: 'Vex', motto: 'No retreat' },
      },
    })
    // Bay patch carries structured state only; Keepsake goes to bayChoices.
    expect(patches.bayPatches[commandBay.id]).toEqual({ npcName: 'Maddox' })
    expect(patches.bayChoices[commandBay.id]?.[commandKeepsakeId]).toEqual(['A medal'])
    // The type ref produces a typeNpc patch (NOT a bay patch) + bayChoices.
    expect(patches.bayPatches[BATTLE_TYPE_ID]).toBeUndefined()
    expect(patches.typeNpc).toEqual({ npcName: 'Vex' })
    expect(patches.bayChoices[BATTLE_TYPE_ID]?.[BATTLE_MOTTO_ID]).toEqual(['No retreat'])
  })
})
