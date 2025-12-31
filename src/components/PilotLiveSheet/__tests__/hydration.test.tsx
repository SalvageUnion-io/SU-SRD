import { describe, test, expect } from 'bun:test'
import { LOCAL_ID } from '../../../lib/cacheHelpers'
import { render } from '../../../test/render'
import PilotLiveSheet from '../index'
import { getHydratedPilotFromCache, getEntitiesFromCache } from '../../../test/liveSheetHelpers'
import {
  setupPilotWithClass,
  addAbilityToPilot,
  addEquipmentToPilot,
} from '../../../test/liveSheetUtils'
import {
  getBaseClass,
  getCoreTreeLevel1Ability,
  getEquipmentWithoutSlots,
} from '../../../test/fixtures'

describe('PilotLiveSheet - Entity Hydration', () => {
  describe('Common Cases', () => {
    test('pilot hydrates with all entities correctly', async () => {
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        const baseClass = getBaseClass()
        setupPilotWithClass(queryClient, LOCAL_ID, baseClass.id)

        const { pilot, entities } = await getHydratedPilotFromCache(queryClient, LOCAL_ID)

        expect(pilot).toBeDefined()
        expect(entities).toBeDefined()
        expect(Array.isArray(entities)).toBe(true)
      }
    })

    test('selected class appears in hydrated pilot', async () => {
      const baseClass = getBaseClass()
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        setupPilotWithClass(queryClient, LOCAL_ID, baseClass.id)

        const entities = getEntitiesFromCache(queryClient, 'pilot', LOCAL_ID)
        const classEntity = entities.find(
          (e) => e.schema_name === 'classes' && e.schema_ref_id === baseClass.id
        )

        expect(classEntity).toBeDefined()
        expect(classEntity?.ref).toBeDefined()
      }
    })

    test('abilities appear in hydrated pilot', async () => {
      const baseClass = getBaseClass()
      const level1Ability = getCoreTreeLevel1Ability(baseClass)

      if (!level1Ability) {
        return
      }

      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        setupPilotWithClass(queryClient, LOCAL_ID, baseClass.id)
        addAbilityToPilot(queryClient, LOCAL_ID, level1Ability.id)

        const entities = getEntitiesFromCache(queryClient, 'pilot', LOCAL_ID)
        const abilityEntities = entities.filter((e) => e.schema_name === 'abilities')

        expect(abilityEntities.length).toBeGreaterThan(0)
        expect(abilityEntities.some((e) => e.schema_ref_id === level1Ability.id)).toBe(true)
      }
    })

    test('equipment appears in hydrated pilot', async () => {
      const equipment = getEquipmentWithoutSlots()
      if (!equipment) {
        return
      }

      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        addEquipmentToPilot(queryClient, LOCAL_ID, equipment.id)

        const entities = getEntitiesFromCache(queryClient, 'pilot', LOCAL_ID)
        const equipmentEntities = entities.filter((e) => e.schema_name === 'equipment')

        expect(equipmentEntities.length).toBeGreaterThan(0)
        expect(equipmentEntities.some((e) => e.schema_ref_id === equipment.id)).toBe(true)
      }
    })
  })

  describe('Corner Cases', () => {
    test('hydrate pilot with no entities', async () => {
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        const entities = getEntitiesFromCache(queryClient, 'pilot', LOCAL_ID)
        expect(Array.isArray(entities)).toBe(true)
        // Should handle empty entities gracefully
      }
    })
  })
})
