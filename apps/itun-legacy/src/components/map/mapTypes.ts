import { z } from 'zod'

export const MAP_TIERS = ['campaign', 'region', 'area'] as const
export type MapTier = (typeof MAP_TIERS)[number]

export const mapZoneSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  shape: z.enum(['rect', 'ellipse']),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
  color: z.string(),
  opacity: z.number().min(0).max(1),
  hasChildLayer: z.boolean(),
})

export type MapZone = z.infer<typeof mapZoneSchema>

export const mapConnectionSchema = z.object({
  id: z.string().uuid(),
  fromZoneId: z.string().uuid(),
  toZoneId: z.string().uuid(),
  color: z.string(),
  label: z.string().optional(),
})

export type MapConnection = z.infer<typeof mapConnectionSchema>

export const mapZonesSchema = z.array(mapZoneSchema)
export const mapConnectionsSchema = z.array(mapConnectionSchema)

export type BreadcrumbEntry = {
  tier: MapTier
  parentZoneId: string | null
  label: string
}

export type EditMode = 'select' | 'draw-rect' | 'draw-ellipse' | 'draw-line' | 'pan'
