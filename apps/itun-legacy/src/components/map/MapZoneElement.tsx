import { memo, useRef } from 'react'
import type { MapZone } from './mapTypes'

type MapZoneElementProps = {
  zone: MapZone
  isSelected: boolean
  isDragging: boolean
  onClick: (zoneId: string) => void
  onPointerDown: (zoneId: string, e: React.PointerEvent) => void
}

export const MapZoneElement = memo(function MapZoneElement({
  zone,
  isSelected,
  isDragging,
  onClick,
  onPointerDown,
}: MapZoneElementProps) {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)

  const strokeColor = isSelected ? '#FFFFFF' : zone.color
  const strokeWidth = isSelected ? 0.4 : 0.2

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
    onPointerDown(zone.id, e)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Only fire click if the pointer didn't move much (i.e. not a drag)
    if (pointerStartRef.current) {
      const dx = Math.abs(e.clientX - pointerStartRef.current.x)
      const dy = Math.abs(e.clientY - pointerStartRef.current.y)
      if (dx > 5 || dy > 5) return
    }
    onClick(zone.id)
  }

  const sharedProps = {
    fill: zone.color,
    fillOpacity: isDragging ? zone.opacity * 0.6 : zone.opacity,
    stroke: strokeColor,
    strokeWidth,
    cursor: 'pointer' as const,
    onClick: handleClick,
    onPointerDown: handlePointerDown,
  }

  return (
    <g>
      {zone.shape === 'ellipse' ? (
        <ellipse
          cx={zone.x + zone.width / 2}
          cy={zone.y + zone.height / 2}
          rx={zone.width / 2}
          ry={zone.height / 2}
          {...sharedProps}
        />
      ) : (
        <rect
          x={zone.x}
          y={zone.y}
          width={zone.width}
          height={zone.height}
          rx={0.5}
          {...sharedProps}
        />
      )}
      <text
        x={zone.x + zone.width / 2}
        y={zone.y + zone.height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontSize={Math.min(zone.width / 6, zone.height / 3, 3)}
        fontFamily="monospace"
        fontWeight="bold"
        pointerEvents="none"
        style={{ textShadow: '0 0 3px rgba(0,0,0,0.8)' }}
      >
        {zone.label}
      </text>
      {zone.hasChildLayer && (
        <text
          x={zone.x + zone.width - 1}
          y={zone.y + 2}
          textAnchor="end"
          fill="#FFFFFF"
          fontSize={1.5}
          fontFamily="monospace"
          pointerEvents="none"
          style={{ textShadow: '0 0 2px rgba(0,0,0,0.8)' }}
        >
          &gt;
        </text>
      )}
    </g>
  )
})
