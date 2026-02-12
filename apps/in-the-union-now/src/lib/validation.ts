import { z } from 'zod'

// Shared validation helpers
const uuid = z.string().uuid()
const jsonValue: z.ZodType = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.record(jsonValue), z.array(jsonValue)])
)
const jsonObject = z.record(jsonValue)

// Pilot validation
export const createPilotSchema = z.object({
  callsign: z.string().min(1, 'Callsign is required').max(100),
  class_ref: z.string().nullable().optional(),
})

export const updatePilotSchema = z.object({
  callsign: z.string().min(1).max(100).optional(),
  class_ref: z.string().nullable().optional(),
  advanced_class_ref: z.string().nullable().optional(),
  max_hp: z.number().int().min(0).optional(),
  current_hp: z.number().int().min(0).optional(),
  max_ap: z.number().int().min(0).optional(),
  current_ap: z.number().int().min(0).optional(),
  current_tp: z.number().int().min(0).optional(),
  appearance: z.string().max(2000).optional(),
  background: z.string().max(2000).optional(),
  keepsake: z.string().max(500).optional(),
  motto: z.string().max(500).optional(),
  background_used: z.boolean().optional(),
  keepsake_used: z.boolean().optional(),
  motto_used: z.boolean().optional(),
  notes: z.string().max(5000).optional(),
  image_url: z.string().url().nullable().optional(),
  crawler_id: uuid.nullable().optional(),
  active: z.boolean().optional(),
  private: z.boolean().optional(),
})

// Mech validation
export const createMechSchema = z.object({
  name: z.string().max(100).optional(),
  chassis_ref: z.string().nullable().optional(),
  pilot_id: uuid.nullable().optional(),
})

export const updateMechSchema = z.object({
  name: z.string().max(100).optional(),
  chassis_ref: z.string().nullable().optional(),
  pattern_name: z.string().nullable().optional(),
  pilot_id: uuid.nullable().optional(),
  current_sp: z.number().int().min(0).optional(),
  max_sp: z.number().int().min(0).optional(),
  current_ep: z.number().int().min(0).optional(),
  max_ep: z.number().int().min(0).optional(),
  current_heat: z.number().int().min(0).optional(),
  heat_capacity: z.number().int().min(0).optional(),
  appearance: z.string().max(2000).optional(),
  quirk: z.string().max(1000).optional(),
  notes: z.string().max(5000).optional(),
  image_url: z.string().url().nullable().optional(),
  active: z.boolean().optional(),
  private: z.boolean().optional(),
})

// Crawler validation
export const createCrawlerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  crawler_ref: z.string().nullable().optional(),
})

export const updateCrawlerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  crawler_ref: z.string().nullable().optional(),
  tech_level: z.number().int().min(1).max(6).optional(),
  max_sp: z.number().int().min(0).optional(),
  current_damage: z.number().int().min(0).optional(),
  upkeep: z.number().int().min(0).optional(),
  upgrade_level: z.number().int().min(0).optional(),
  scrap_tl1: z.number().int().min(0).optional(),
  scrap_tl2: z.number().int().min(0).optional(),
  scrap_tl3: z.number().int().min(0).optional(),
  scrap_tl4: z.number().int().min(0).optional(),
  scrap_tl5: z.number().int().min(0).optional(),
  scrap_tl6: z.number().int().min(0).optional(),
  description: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  image_url: z.string().url().nullable().optional(),
  active: z.boolean().optional(),
  private: z.boolean().optional(),
})

// Entity ref validation
const parentType = z.enum(['pilot', 'mech', 'crawler'])
const itemCondition = z.enum(['intact', 'damaged', 'destroyed'])

export const createEntityRefSchema = z.object({
  parent_type: parentType,
  parent_id: uuid,
  schema_name: z.string().min(1),
  schema_ref_id: z.string().min(1),
  condition: itemCondition.optional(),
  parent_entity_ref_id: uuid.nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
  metadata: jsonObject.optional(),
})

export const updateEntityRefSchema = z.object({
  condition: itemCondition.optional(),
  sort_order: z.number().int().min(0).optional(),
  metadata: jsonObject.optional(),
})

// Player choice validation
export const createPlayerChoiceSchema = z
  .object({
    entity_ref_id: uuid.nullable().optional(),
    parent_choice_id: uuid.nullable().optional(),
    choice_ref_id: z.string().min(1),
    value: z.string().min(1),
  })
  .refine(
    (data) =>
      (data.entity_ref_id && !data.parent_choice_id) ||
      (!data.entity_ref_id && data.parent_choice_id),
    { message: 'Exactly one of entity_ref_id or parent_choice_id must be set' }
  )

// Cargo validation
export const createCargoSchema = z.object({
  parent_type: z.enum(['mech', 'crawler']),
  parent_id: uuid,
  name: z.string().max(200).nullable().optional(),
  schema_name: z.string().nullable().optional(),
  schema_ref_id: z.string().nullable().optional(),
  amount: z.number().int().min(1).optional(),
  metadata: jsonObject.optional(),
})

export const updateCargoSchema = z.object({
  name: z.string().max(200).nullable().optional(),
  amount: z.number().int().min(1).optional(),
  metadata: jsonObject.optional(),
})

// Type exports for form usage
export type CreatePilotInput = z.infer<typeof createPilotSchema>
export type UpdatePilotInput = z.infer<typeof updatePilotSchema>
export type CreateMechInput = z.infer<typeof createMechSchema>
export type UpdateMechInput = z.infer<typeof updateMechSchema>
export type CreateCrawlerInput = z.infer<typeof createCrawlerSchema>
export type UpdateCrawlerInput = z.infer<typeof updateCrawlerSchema>
export type CreateEntityRefInput = z.infer<typeof createEntityRefSchema>
export type UpdateEntityRefInput = z.infer<typeof updateEntityRefSchema>
export type CreateCargoInput = z.infer<typeof createCargoSchema>
export type UpdateCargoInput = z.infer<typeof updateCargoSchema>
