import { memo } from 'react'
import type { MapConnection, MapZone } from './mapTypes'
import { getZoneCenter, resolveConnectionColor } from './mapUtils'

type MapConnectionElementProps = {
  connection: MapConnection
  zones: MapZone[]
  isSelected: boolean
  onClick: (connectionId: string) => void
}

export const MapConnectionElement = memo(function MapConnectionElement({
  connection,
  zones,
  isSelected,
  onClick,
}: MapConnectionElementProps) {
  const fromZone = zones.find((z) => z.id === connection.fromZoneId)
  const toZone = zones.find((z) => z.id === connection.toZoneId)
  if (!fromZone || !toZone) return null

  const from = getZoneCenter(fromZone)
  const to = getZoneCenter(toZone)
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2
  const lineColor = resolveConnectionColor(connection, zones)

  return (
    <g>
      {/* Wider invisible hit target for easier clicking */}
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="transparent"
        strokeWidth={1.5}
        cursor="pointer"
        onClick={(e) => {
          e.stopPropagation()
          onClick(connection.id)
        }}
      />
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={lineColor}
        strokeWidth={isSelected ? 0.5 : 0.3}
        strokeDasharray={isSelected ? undefined : '1 0.5'}
        strokeLinecap="round"
        pointerEvents="none"
      />
      {connection.label && (
        <text
          x={midX}
          y={midY - 1}
          textAnchor="middle"
          fill={lineColor}
          fontSize={1.5}
          fontFamily="monospace"
          pointerEvents="none"
          style={{ textShadow: '0 0 3px rgba(0,0,0,0.9)' }}
        >
          {connection.label}
        </text>
      )}
    </g>
  )
})
