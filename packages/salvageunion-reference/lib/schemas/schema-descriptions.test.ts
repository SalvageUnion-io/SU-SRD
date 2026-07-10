/**
 * Tests that all exported Zod schemas have meaningful descriptions
 * on the schema itself and on all required properties.
 *
 * This ensures generated JSON Schema files have useful documentation.
 */

import { describe, expect, it } from 'bun:test'
import { z } from '../zod.js'

import {
  AbilitySchema,
  AbilityTreeRequirementSchema,
  MetaActionSchema,
  BioTitanSchema,
  ChassisSchema,
  ClassSchema,
  CrawlerBaySchema,
  CrawlerTechLevelSchema,
  CrawlerSchema,
  CreatureSchema,
  DistanceSchema,
  DroneSchema,
  EquipmentSchema,
  FactionSchema,
  KeywordSchema,
  MeldSchema,
  ModuleSchema,
  NPCSchema,
  RollTableSchema,
  SquadSchema,
  SystemSchema,
  TraitEntitySchema,
  VehicleSchema,
  GuideSchema,
  SourceEntitySchema,
  TechLevelEntitySchema,
  CatalogCategorySchema,
} from './entities.js'

import {
  TraitSchema,
  StatsSchema,
  ChassisStatsSchema,
  EquipmentStatsSchema,
  CombatEntitySchema,
  MechanicalEntitySchema,
  DataValueSchema,
  ContentBlockSchema,
  ContentSchema,
  TableContentSchema,
  TableSchema,
  PatternSystemModuleSchema,
  MechStatBonusSchema,
  SystemModuleSchema,
  ChoiceSchema,
  NpcSchema,
  PatternSchema,
  DamageSchema,
  ActionSchema,
  AdditionalSourceSchema,
  BaseEntitySchema,
  AdvancedClassSchema,
  FormationMechSchema,
  GrantSchema,
  CrawlerMutationSchema,
  GuideStepSchema,
} from './objects.js'

import {
  SourceSchema,
  ContentTypeSchema,
  RangeItemSchema,
  RangeSchema,
  ActionTypeSchema,
  DamageTypeSchema,
  ClassTypeSchema,
  TreeSchema,
  SchemaNameSchema,
} from './enums.js'

import {
  IdSchema,
  NameSchema,
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
  ActivationCostSchema,
  TechLevelSchema,
} from './common.js'

type JsonSchemaObject = {
  description?: string
  type?: string | string[]
  properties?: Record<string, { description?: string }>
  required?: string[]
  items?: JsonSchemaObject
  anyOf?: JsonSchemaObject[]
  allOf?: JsonSchemaObject[]
  oneOf?: JsonSchemaObject[]
}

/** Narrow away null/undefined; throws (failing the test) when the value is missing. */
function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Expected value to be defined')
  }
  return value
}

/**
 * Convert a Zod schema to JSON Schema and extract description info.
 */
function toJsonSchema(zodSchema: z.ZodType): JsonSchemaObject {
  return z.toJSONSchema(zodSchema, {
    target: 'draft-07',
    unrepresentable: 'any',
  }) as JsonSchemaObject
}

/**
 * Collect all required property names from a JSON Schema object,
 * handling anyOf/allOf/oneOf unions.
 */
function getRequiredProperties(jsonSchema: JsonSchemaObject): string[] {
  if (jsonSchema.required) {
    return jsonSchema.required
  }

  // For union types (anyOf, allOf, oneOf), collect from all branches
  const branches = [
    ...(jsonSchema.anyOf ?? []),
    ...(jsonSchema.allOf ?? []),
    ...(jsonSchema.oneOf ?? []),
  ]

  const allRequired = new Set<string>()
  for (const branch of branches) {
    const branchRequired = getRequiredProperties(branch)
    for (const r of branchRequired) {
      allRequired.add(r)
    }
  }
  return [...allRequired]
}

/**
 * Collect all properties from a JSON Schema object,
 * handling anyOf/allOf/oneOf unions.
 */
function getProperties(jsonSchema: JsonSchemaObject): Record<string, { description?: string }> {
  if (jsonSchema.properties) {
    return jsonSchema.properties
  }

  const branches = [
    ...(jsonSchema.anyOf ?? []),
    ...(jsonSchema.allOf ?? []),
    ...(jsonSchema.oneOf ?? []),
  ]

  const allProps: Record<string, { description?: string }> = {}
  for (const branch of branches) {
    const branchProps = getProperties(branch)
    Object.assign(allProps, branchProps)
  }
  return allProps
}

// Entity schemas -- these are the top-level schemas that generate .schema.json files
const entitySchemas: Record<string, z.ZodType> = {
  AbilitySchema,
  AbilityTreeRequirementSchema,
  MetaActionSchema,
  BioTitanSchema,
  ChassisSchema,
  ClassSchema,
  CrawlerBaySchema,
  CrawlerTechLevelSchema,
  CrawlerSchema,
  CreatureSchema,
  DistanceSchema,
  DroneSchema,
  EquipmentSchema,
  FactionSchema,
  KeywordSchema,
  MeldSchema,
  ModuleSchema,
  NPCSchema,
  RollTableSchema,
  SquadSchema,
  SystemSchema,
  TraitEntitySchema,
  VehicleSchema,
  GuideSchema,
  SourceEntitySchema,
  TechLevelEntitySchema,
  CatalogCategorySchema,
}

// Object schemas -- shared building blocks
const objectSchemas: Record<string, z.ZodType> = {
  TraitSchema,
  StatsSchema,
  ChassisStatsSchema,
  EquipmentStatsSchema,
  CombatEntitySchema,
  MechanicalEntitySchema,
  DataValueSchema,
  ContentBlockSchema,
  ContentSchema,
  TableContentSchema,
  TableSchema,
  PatternSystemModuleSchema,
  MechStatBonusSchema,
  SystemModuleSchema,
  ChoiceSchema,
  NpcSchema,
  PatternSchema,
  DamageSchema,
  ActionSchema,
  AdditionalSourceSchema,
  BaseEntitySchema,
  AdvancedClassSchema,
  FormationMechSchema,
  GrantSchema,
  CrawlerMutationSchema,
  GuideStepSchema,
}

// Enum schemas
const enumSchemas: Record<string, z.ZodType> = {
  SourceSchema,
  ContentTypeSchema,
  RangeItemSchema,
  RangeSchema,
  ActionTypeSchema,
  DamageTypeSchema,
  ClassTypeSchema,
  TreeSchema,
  SchemaNameSchema,
}

// Common schemas
const commonSchemas: Record<string, z.ZodType> = {
  IdSchema,
  NameSchema,
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
  ActivationCostSchema,
  TechLevelSchema,
}

describe('Schema descriptions', () => {
  describe('entity schemas have top-level descriptions', () => {
    for (const [name, schema] of Object.entries(entitySchemas)) {
      it(`${name} has a description`, () => {
        const jsonSchema = toJsonSchema(schema)
        const description =
          jsonSchema.description ??
          jsonSchema.anyOf?.[0]?.description ??
          jsonSchema.allOf?.[0]?.description
        expect(description).toBeTruthy()
        expect(typeof description).toBe('string')
        expect((description as string).length).toBeGreaterThan(5)
      })
    }
  })

  describe('entity schemas have descriptions on required properties', () => {
    for (const [name, schema] of Object.entries(entitySchemas)) {
      it(`${name} required properties have descriptions`, () => {
        const jsonSchema = toJsonSchema(schema)
        const required = getRequiredProperties(jsonSchema)
        const properties = getProperties(jsonSchema)

        const missingDescriptions: string[] = []
        for (const propName of required) {
          const prop = properties[propName]
          if (prop && !prop.description) {
            missingDescriptions.push(propName)
          }
        }

        expect(
          missingDescriptions,
          `${name} is missing descriptions on required properties: ${missingDescriptions.join(', ')}`
        ).toEqual([])
      })
    }
  })

  describe('object schemas have top-level descriptions', () => {
    for (const [name, schema] of Object.entries(objectSchemas)) {
      it(`${name} has a description`, () => {
        const jsonSchema = toJsonSchema(schema)
        const description =
          jsonSchema.description ??
          jsonSchema.anyOf?.[0]?.description ??
          jsonSchema.allOf?.[0]?.description
        expect(description).toBeTruthy()
        expect(typeof description).toBe('string')
        expect((description as string).length).toBeGreaterThan(5)
      })
    }
  })

  describe('enum schemas have top-level descriptions', () => {
    for (const [name, schema] of Object.entries(enumSchemas)) {
      it(`${name} has a description`, () => {
        const jsonSchema = toJsonSchema(schema)
        expect(jsonSchema.description).toBeTruthy()
        expect(typeof jsonSchema.description).toBe('string')
        expect(defined(jsonSchema.description).length).toBeGreaterThan(5)
      })
    }
  })

  describe('common schemas have top-level descriptions', () => {
    for (const [name, schema] of Object.entries(commonSchemas)) {
      it(`${name} has a description`, () => {
        const jsonSchema = toJsonSchema(schema)
        expect(jsonSchema.description).toBeTruthy()
        expect(typeof jsonSchema.description).toBe('string')
        expect(defined(jsonSchema.description).length).toBeGreaterThan(5)
      })
    }
  })
})
