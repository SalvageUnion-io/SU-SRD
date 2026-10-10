import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { crawlerFixture } from '../../../components/__tests__/fixtures'
import { crewSlotsOf } from '../../npcs/npcModel'
import { npcCreationStepGate } from '../../rules/creation'
import { NpcSchema } from '../../schemas/npc'
import { crewDraftToCreateInput, crewDraftView } from '../crewFormState'
import {
  addNpcAction,
  addNpcTrait,
  applyBlankStart,
  applyNpcTemplate,
  EMPTY_NPC_FORM,
  npcFormToCreateInput,
  statsEditedSinceFill,
  toggleNpcAction,
  toggleNpcTrait,
} from '../npcFormState'

/**
 * The designer's form (issue 1269 phase 3's gate: every template kind pre-fills
 * correctly) and the crew slot form (D2–D3).
 */

const now = '2026-01-01T00:00:00.000Z'

function reference(name: string) {
  const ref = SalvageUnionReference.NPCs.getByName(name)
  if (!ref) throw new Error(`${name} is in npcs.json`)
  return ref
}

/** The create input as a whole record, for a schema parse. */
function asRecord(input: object) {
  return { ...input, id: 'n1', createdAt: now, updatedAt: now }
}

describe('each template kind pre-fills correctly', () => {
  test('a reference NPC fills Stats and Actions & traits, and keeps Identity (D4)', () => {
    const named = { ...EMPTY_NPC_FORM, name: 'Sergeant Kessler', motto: 'Hold the line.' }
    const form = applyNpcTemplate(named, reference('Veteran'))
    expect(form).toMatchObject({
      templateRef: { schema: 'npcs', slug: 'veteran' },
      templateChosen: true,
      hitPoints: '9',
      damageType: 'HP',
      bioSalvageValue: '',
      actions: ['green-laser-rifle-veteran', 'portable-comms-unit-npc'],
      offeredActions: ['green-laser-rifle-veteran', 'portable-comms-unit-npc'],
      name: 'Sergeant Kessler',
      motto: 'Hold the line.',
    })
    // The template's prose is never copied in (D5).
    expect(form.description).toBe('')
  })

  test('a bio-salvage template carries its value', () => {
    expect(applyNpcTemplate(EMPTY_NPC_FORM, reference('Chimerium Chosen')).bioSalvageValue).toBe(
      '2'
    )
  })

  test('a blank start fills nothing, and HP is still the player’s to set', () => {
    const veteran = applyNpcTemplate(EMPTY_NPC_FORM, reference('Veteran'))
    const blank = applyBlankStart({ ...veteran, name: 'Kessler' })
    expect(blank).toMatchObject({
      templateRef: null,
      templateChosen: true,
      hitPoints: '',
      actions: [],
      traits: [],
      name: 'Kessler',
    })
    expect(npcCreationStepGate('stats', blank).ok).toBe(false)
  })

  test('a crawler bay fixes position and HP; the player writes the rest (D2)', () => {
    const [medBay] = crewSlotsOf(crawlerFixture({ id: 'c1', crawlerBays: [{ bayRef: 'med-bay' }] }))
    if (!medBay) throw new Error('the Med Bay is a crew slot')
    const draft = {
      Name: 'Doc Ambrose',
      Description: 'Steady hands, cracked spectacles.',
      Keepsake: 'A dented tin of boiled sweets',
      Motto: 'Bleed later.',
    }
    const input = crewDraftToCreateInput(medBay, draft, null)
    expect(input).toMatchObject({
      name: 'Doc Ambrose',
      position: 'Doc',
      hitPoints: 4,
      keepsake: 'A dented tin of boiled sweets',
      motto: 'Bleed later.',
      templateRef: { schema: 'crawler-bays', slug: 'med-bay' },
      actions: [],
      gameId: null,
    })
    expect(NpcSchema.safeParse(asRecord(input)).success).toBe(true)
  })

  test('a crawler type’s NPC keeps its other choices in choiceValues, at HP 0 (D3)', () => {
    const [ai] = crewSlotsOf(crawlerFixture({ id: 'c1', type: 'augmented' }))
    if (!ai) throw new Error('the Augmented type has an NPC')
    const draft = { Name: 'MOTHER', 'A.I. Personality': 'Protective' }
    expect(crewDraftView(ai, draft).choiceValues).toEqual({ 'A.I. Personality': 'Protective' })
    const input = crewDraftToCreateInput(ai, draft, 'g1')
    expect(input).toMatchObject({ hitPoints: 0, position: 'Union Crawler A.I.', gameId: 'g1' })
    expect(NpcSchema.safeParse(asRecord(input)).success).toBe(true)
  })
})

describe('the gates are a name and HP ≥ 1', () => {
  test('a template answers the first step, Next needs HP, Save needs a name', () => {
    expect(npcCreationStepGate('template', EMPTY_NPC_FORM).ok).toBe(false)
    const form = applyNpcTemplate(EMPTY_NPC_FORM, reference('Wastelander'))
    expect(npcCreationStepGate('template', form).ok).toBe(true)
    expect(npcCreationStepGate('stats', form).ok).toBe(true)
    expect(
      npcCreationStepGate(
        'actions',
        toggleNpcAction(form, 'improvised-melee-weapon-wastelander', false)
      ).ok
    ).toBe(true)
    expect(npcCreationStepGate('review', form).ok).toBe(false)
    expect(npcCreationStepGate('review', { ...form, name: 'Rook' }).ok).toBe(true)
    expect(npcCreationStepGate('review', { ...form, name: 'Rook', hitPoints: '0' }).ok).toBe(false)
  })
})

describe('actions and traits come from the reference (D6)', () => {
  test('unchecking keeps an action offered, so it can be checked again in place', () => {
    const form = applyNpcTemplate(EMPTY_NPC_FORM, reference('Veteran'))
    const off = toggleNpcAction(form, 'green-laser-rifle-veteran', false)
    expect(off.actions).toEqual(['portable-comms-unit-npc'])
    expect(off.offeredActions).toHaveLength(2)
    expect(toggleNpcAction(off, 'green-laser-rifle-veteran', true).actions).toEqual(form.actions)
  })

  test('the search adds an action, checked, and a trait with no amount', () => {
    let form = addNpcAction(EMPTY_NPC_FORM, 'rifle-trooper')
    form = addNpcTrait(form, 'fast')
    expect(form.actions).toEqual(['rifle-trooper'])
    expect(form.traits).toEqual([{ type: 'fast' }])
    expect(toggleNpcTrait(form, 'fast', false).traits).toEqual([])
  })

  test('changing the template asks first only when the stats were edited', () => {
    const form = applyNpcTemplate(EMPTY_NPC_FORM, reference('Veteran'))
    expect(statsEditedSinceFill(form)).toBe(false)
    expect(statsEditedSinceFill({ ...form, hitPoints: '12' })).toBe(true)
    expect(statsEditedSinceFill(toggleNpcAction(form, 'portable-comms-unit-npc', false))).toBe(true)
    expect(statsEditedSinceFill(applyBlankStart(EMPTY_NPC_FORM))).toBe(false)
  })
})

describe('the create input', () => {
  test('is a valid NPC, with only what the player wrote', () => {
    const form = {
      ...applyNpcTemplate(EMPTY_NPC_FORM, reference('Veteran')),
      name: '  Sergeant Kessler ',
      position: 'Union Quartermaster',
    }
    const input = npcFormToCreateInput(form)
    expect(input).toEqual({
      schemaVersion: 1,
      name: 'Sergeant Kessler',
      position: 'Union Quartermaster',
      hitPoints: 9,
      damageType: 'HP',
      actions: ['green-laser-rifle-veteran', 'portable-comms-unit-npc'],
      traits: [],
      templateRef: { schema: 'npcs', slug: 'veteran' },
    })
    expect(NpcSchema.safeParse(asRecord(input)).success).toBe(true)
  })
})
