import { describe, test, expect } from 'bun:test'
import { render, waitFor } from '../test/render'
import { EntityDisplay } from 'suref-react'
import { getSchemaCatalog } from 'salvageunion-reference'
import { getModel } from 'salvageunion-reference'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { act } from '@testing-library/react'

// In CI, test all entities exhaustively. Locally, sample 5 per schema for speed.
const IS_CI = process.env.CI === 'true'
const SAMPLE_SIZE = IS_CI ? Infinity : 5

const schemaCatalog = getSchemaCatalog()

// Automatically exclude meta schemas (schemas marked with meta: true)
const SCHEMAS_TO_TEST = schemaCatalog.schemas
  .filter((schema) => !schema.meta)
  .map((schema) => schema.id) as SURefEnumSchemaName[]

type PropertyCheckConfig = {
  /** Properties that should appear as numbers in the rendered output */
  numericProps?: string[]
  /** Properties that should appear as text (length > 1) in the rendered output */
  textProps?: string[]
}

const SCHEMA_PROPERTY_CHECKS: Record<string, PropertyCheckConfig> = {
  chassis: { numericProps: ['systemSlots', 'moduleSlots', 'salvageValue'] },
  systems: { numericProps: ['slotsRequired', 'heat', 'ep'] },
  modules: { numericProps: ['slotsRequired', 'heat', 'ep'] },
  equipment: { numericProps: ['slotsRequired'] },
  crawlers: { numericProps: ['systemSlots', 'moduleSlots', 'cargoCapacity'] },
  creatures: { numericProps: ['structurePoints', 'energyPoints'] },
  drones: { numericProps: ['structurePoints', 'energyPoints'] },
  vehicles: { numericProps: ['structurePoints'] },
  'bio-titans': { numericProps: ['structurePoints', 'energyPoints'] },
  npcs: { numericProps: ['hp', 'ap'] },
  squads: { numericProps: ['structurePoints'] },
  'classes.core': { numericProps: ['startingHp', 'startingAp'] },
  'roll-tables': { textProps: ['name'] },
}

/**
 * Helper function to verify entity properties are rendered
 */
function verifyEntityProperties(
  textContent: string,
  entity: SURefEntity,
  schemaId: SURefEnumSchemaName
) {
  if ('description' in entity && entity.description) {
    const descriptionWithoutBrackets = entity.description
      .replace(/\[\[\[([^\]]+)\]\s*\(([^)]+)\)\]\]/g, '$1 ($2)')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
    expect(textContent).toContain(descriptionWithoutBrackets)
  }

  const propertyChecks = SCHEMA_PROPERTY_CHECKS[schemaId]
  if (!propertyChecks) return

  propertyChecks.numericProps?.forEach((prop) => {
    if (prop in entity) {
      const value = entity[prop as keyof typeof entity]
      if (typeof value === 'number') {
        expect(textContent).toContain(String(value))
      }
    }
  })

  propertyChecks.textProps?.forEach((prop) => {
    if (prop in entity) {
      const value = entity[prop as keyof typeof entity]
      if (typeof value === 'string' && value.length > 1) {
        // For roll-tables, the name is already checked separately at line 109
        // so we skip checking it again here to avoid duplicate checks
        if (schemaId === 'roll-tables' && prop === 'name') {
          return
        }
        expect(textContent).toContain(value)
      }
    }
  })
}

/**
 * Helper function to get all entities for a schema
 */
function getSchemaEntities(schemaId: SURefEnumSchemaName): SURefEntity[] {
  const model = getModel(schemaId)
  return model?.all() || []
}

describe('Schema Entity Display Tests', () => {
  for (const schemaId of SCHEMAS_TO_TEST) {
    describe(`Schema: ${schemaId}`, () => {
      const allEntities = getSchemaEntities(schemaId)
      // Sample entities for local development, all entities in CI
      const entitiesToTest = allEntities.slice(0, SAMPLE_SIZE)

      if (entitiesToTest.length === 0) {
        test.skip(`No entities found for ${schemaId}`, () => {})
      }

      for (const entity of entitiesToTest) {
        test(`displays all properties for: ${entity.name}`, async () => {
          let result: Awaited<ReturnType<typeof render>>
          await act(async () => {
            result = await render(
              <EntityDisplay data={entity as SURefEntity} compact={false} collapsible={false} />
            )
          })

          await waitFor(() => {
            const entityNameElements = result!.getAllByText(entity.name, { exact: false })
            expect(entityNameElements.length).toBeGreaterThan(0)
          })

          const textContent = result!.container.textContent || ''
          verifyEntityProperties(textContent, entity, schemaId)

          // Verify footer renders page number and source for all entities
          if ('page' in entity && entity.page) {
            expect(textContent).toContain(`Page ${entity.page}`)
          }
          if ('source' in entity && entity.source) {
            expect(textContent).toContain(entity.source as string)
          }
        })
      }
    })
  }
})
