import type { MapTier } from './mapTypes'

export const TIER_LABELS: Record<MapTier, string> = {
  campaign: 'Campaign Map',
  region: 'Region Map',
  area: 'Area Map',
}

export const MOVEMENT_RULES: Record<MapTier, { crawler: string; pilot: string; mech: string }> = {
  campaign: { crawler: '1 week / point', pilot: '1 week / point', mech: '1 day / point' },
  region: { crawler: '1 day / point', pilot: '1 day / point', mech: '1 hour / point' },
  area: { crawler: '1 hour / point', pilot: '1 hour / point', mech: '10 min / point' },
}

export const CHILD_TIER: Record<MapTier, MapTier | null> = {
  campaign: 'region',
  region: 'area',
  area: null,
}

export const ZONE_COLORS = [
  '#FF6B35',
  '#E91E63',
  '#9C27B0',
  '#3F51B5',
  '#03A9F4',
  '#009688',
  '#4CAF50',
  '#CDDC39',
  '#FF9800',
  '#795548',
] as const

export const CONNECTION_COLORS = [
  '#FFFFFF',
  '#FF6B35',
  '#E91E63',
  '#03A9F4',
  '#4CAF50',
  '#FF9800',
] as const

export const DEFAULT_ZONE_COLOR = ZONE_COLORS[0]
export const DEFAULT_ZONE_OPACITY = 0.3

export const MIN_ZOOM = 1
export const MAX_ZOOM = 6
export const ZOOM_STEP = 0.15
