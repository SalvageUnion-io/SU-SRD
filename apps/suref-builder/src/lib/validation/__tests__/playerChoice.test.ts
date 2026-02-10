import { describe, test, expect } from 'bun:test'
import { upsertPlayerChoiceSchema } from '../playerChoice'

describe('upsertPlayerChoiceSchema', () => {
  const validEntityChoice = {
    entity_id: 'entity-123',
    choice_ref_id: 'weapon-choice',
    value: 'systems::laser-rifle',
  }

  const validNestedChoice = {
    player_choice_id: 'choice-123',
    choice_ref_id: 'modification',
    value: 'Rangefinder',
  }

  describe('valid inputs', () => {
    test('accepts entity-based choice', () => {
      const result = upsertPlayerChoiceSchema.safeParse(validEntityChoice)
      expect(result.success).toBe(true)
    })

    test('accepts nested choice (player_choice_id)', () => {
      const result = upsertPlayerChoiceSchema.safeParse(validNestedChoice)
      expect(result.success).toBe(true)
    })
  })

  describe('invalid inputs - missing parent', () => {
    test('rejects choice with neither entity_id nor player_choice_id', () => {
      const result = upsertPlayerChoiceSchema.safeParse({
        choice_ref_id: 'weapon-choice',
        value: 'some-value',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('invalid inputs - both parents set', () => {
    test('rejects choice with both entity_id and player_choice_id', () => {
      const result = upsertPlayerChoiceSchema.safeParse({
        entity_id: 'entity-123',
        player_choice_id: 'choice-123',
        choice_ref_id: 'weapon-choice',
        value: 'some-value',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('required fields', () => {
    test('rejects missing choice_ref_id', () => {
      const result = upsertPlayerChoiceSchema.safeParse({
        entity_id: 'entity-123',
        value: 'some-value',
      })
      expect(result.success).toBe(false)
    })

    test('rejects missing value', () => {
      const result = upsertPlayerChoiceSchema.safeParse({
        entity_id: 'entity-123',
        choice_ref_id: 'weapon-choice',
      })
      expect(result.success).toBe(false)
    })
  })
})
