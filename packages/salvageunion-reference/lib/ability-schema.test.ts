/**
 * Tests asserting AbilitySchema field optionality matches the actual data.
 *
 * Data audit of abilities.json (103 entries):
 *   - tree:    103/103 — always present → required
 *   - level:   103/103 — always present → required
 *   - actions: 103/103 — always present → required
 *   - description:        103/103 — now always present, but kept optional so
 *                                  homebrew data need not supply one
 *   - mechActionType:       7/103 — sometimes present → optional (unchanged)
 *   - grants:               6/103 — sometimes present → optional (unchanged)
 *   - activationCurrency:   1/103 — sometimes present → optional (unchanged)
 */

import { describe, expect, it } from 'bun:test'
import { AbilitySchema } from './schemas/entities.js'

describe('AbilitySchema field optionality', () => {
  const baseAbility = {
    id: 'ef787157-c4d4-44bf-857f-71eec0db7939',
    name: 'Engineering Expertise',
    source: 'Salvage Union Workshop Manual',
    tree: 'Mechanical Knowledge',
    level: 1,
    page: 28,
    actions: ['Engineering Expertise'],
  }

  describe('required fields', () => {
    it('rejects an ability missing tree', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tree: _tree, ...withoutTree } = baseAbility
      const result = AbilitySchema.safeParse(withoutTree)
      expect(result.success).toBe(false)
    })

    it('rejects an ability missing level', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { level: _level, ...withoutLevel } = baseAbility
      const result = AbilitySchema.safeParse(withoutLevel)
      expect(result.success).toBe(false)
    })

    it('rejects an ability missing actions', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { actions: _actions, ...withoutActions } = baseAbility
      const result = AbilitySchema.safeParse(withoutActions)
      expect(result.success).toBe(false)
    })

    it('accepts a minimal valid ability with only required fields', () => {
      const result = AbilitySchema.safeParse(baseAbility)
      expect(result.success).toBe(true)
    })
  })

  describe('required fields are non-optional in the inferred type', () => {
    it('tree is not optional on the inferred type', () => {
      // This is a compile-time check expressed at runtime:
      // if tree were optional, undefined would be assignable.
      // We verify by ensuring the schema shape marks it required.
      const shape = AbilitySchema.shape
      const treeField = shape.tree
      // A required ZodType has no _def.typeName of ZodOptional wrapping it
      expect(treeField.isOptional()).toBe(false)
    })

    it('level is not optional on the inferred type', () => {
      const shape = AbilitySchema.shape
      expect(shape.level.isOptional()).toBe(false)
    })

    it('actions is not optional on the inferred type', () => {
      const shape = AbilitySchema.shape
      expect(shape.actions.isOptional()).toBe(false)
    })
  })

  describe('optional fields remain optional', () => {
    it('accepts ability without description', () => {
      const result = AbilitySchema.safeParse(baseAbility)
      expect(result.success).toBe(true)
    })

    it('accepts ability without mechActionType', () => {
      const result = AbilitySchema.safeParse(baseAbility)
      expect(result.success).toBe(true)
    })

    it('accepts ability without grants', () => {
      const result = AbilitySchema.safeParse(baseAbility)
      expect(result.success).toBe(true)
    })

    it('accepts ability without activationCurrency', () => {
      const result = AbilitySchema.safeParse(baseAbility)
      expect(result.success).toBe(true)
    })

    it('description is optional on the inferred type', () => {
      const shape = AbilitySchema.shape
      expect(shape.description.isOptional()).toBe(true)
    })

    it('mechActionType is optional on the inferred type', () => {
      const shape = AbilitySchema.shape
      expect(shape.mechActionType.isOptional()).toBe(true)
    })

    it('grants is optional on the inferred type', () => {
      const shape = AbilitySchema.shape
      expect(shape.grants.isOptional()).toBe(true)
    })

    it('activationCurrency is optional on the inferred type', () => {
      const shape = AbilitySchema.shape
      expect(shape.activationCurrency.isOptional()).toBe(true)
    })
  })
})
