import type { MapZone, MapConnection } from './mapTypes'

/** Get the center point of a zone in percentage coordinates */
export function getZoneCenter(zone: MapZone): { x: number; y: number } {
  return {
    x: zone.x + zone.width / 2,
    y: zone.y + zone.height / 2,
  }
}

/** Convert a mouse event position to percentage coordinates relative to the SVG */
export function clientToPercent(
  clientX: number,
  clientY: number,
  svgRect: DOMRect
): { x: number; y: number } {
  return {
    x: ((clientX - svgRect.left) / svgRect.width) * 100,
    y: ((clientY - svgRect.top) / svgRect.height) * 100,
  }
}

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Normalize a drawn rectangle (handle negative width/height from drag direction) */
export function normalizeRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): { x: number; y: number; width: number; height: number } {
  const x = Math.min(startX, endX)
  const y = Math.min(startY, endY)
  return {
    x: clamp(x, 0, 100),
    y: clamp(y, 0, 100),
    width: clamp(Math.abs(endX - startX), 1, 100 - x),
    height: clamp(Math.abs(endY - startY), 1, 100 - y),
  }
}

/** Resolve connection color from endpoint zones: matching colors use that color, different colors use black */
export function resolveConnectionColor(connection: MapConnection, zones: MapZone[]): string {
  const fromZone = zones.find((z) => z.id === connection.fromZoneId)
  const toZone = zones.find((z) => z.id === connection.toZoneId)
  if (!fromZone || !toZone) return '#000000'
  return fromZone.color === toZone.color ? fromZone.color : '#000000'
}
