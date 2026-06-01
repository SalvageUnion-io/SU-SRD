import { useCallback, useRef, useState } from 'react'
import type { MapZone, MapConnection, EditMode } from './mapTypes'
import { MapZoneElement } from './MapZoneElement'
import { MapConnectionElement } from './MapConnectionElement'
import { clientToPercent, normalizeRect, clamp } from './mapUtils'
import {
  DEFAULT_ZONE_COLOR,
  DEFAULT_ZONE_OPACITY,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
} from './mapConstants'

type MapCanvasProps = {
  backgroundUrl: string | null
  zones: MapZone[]
  connections: MapConnection[]
  editMode: EditMode
  selectedZoneId: string | null
  selectedConnectionId: string | null
  lineFromZoneId: string | null
  panOffset: { x: number; y: number }
  zoomLevel: number
  isMediator: boolean
  onZoneClick: (zoneId: string) => void
  onConnectionClick: (connectionId: string) => void
  onZoneCreate: (zone: MapZone) => void
  onZoneMove: (zoneId: string, x: number, y: number) => void
  onConnectionCreate: (connection: MapConnection) => void
  onPanChange: (offset: { x: number; y: number }) => void
  onZoomChange: (level: number) => void
  onLineFromZoneChange: (zoneId: string | null) => void
  onCanvasClick: () => void
}

export function MapCanvas({
  backgroundUrl,
  zones,
  connections,
  editMode,
  selectedZoneId,
  selectedConnectionId,
  lineFromZoneId,
  panOffset,
  zoomLevel,
  isMediator,
  onZoneClick,
  onConnectionClick,
  onZoneCreate,
  onZoneMove,
  onConnectionCreate,
  onPanChange,
  onZoomChange,
  onLineFromZoneChange,
  onCanvasClick,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Drawing state
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null)

  // Pan state
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null)

  // Drag-move state
  const [dragZoneId, setDragZoneId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)

  const getSvgRect = useCallback(() => {
    return svgRef.current?.getBoundingClientRect() ?? null
  }, [])

  // Wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      onZoomChange(clamp(zoomLevel + delta, MIN_ZOOM, MAX_ZOOM))
    },
    [zoomLevel, onZoomChange]
  )

  // Pointer down
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isMediator) return

      const rect = getSvgRect()
      if (!rect) return

      if (editMode === 'pan') {
        setIsPanning(true)
        setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        return
      }

      if (editMode === 'draw-rect' || editMode === 'draw-ellipse') {
        const point = clientToPercent(e.clientX, e.clientY, rect)
        setDrawStart(point)
        setDrawCurrent(point)
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      }
    },
    [isMediator, editMode, panOffset, getSvgRect]
  )

  // Pointer move
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isPanning && panStart) {
        onPanChange({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        })
        return
      }

      if (dragZoneId && dragOffset) {
        const rect = getSvgRect()
        if (!rect) return
        const point = clientToPercent(e.clientX, e.clientY, rect)
        const zone = zones.find((z) => z.id === dragZoneId)
        if (!zone) return
        const newX = clamp(point.x - dragOffset.x, 0, 100 - zone.width)
        const newY = clamp(point.y - dragOffset.y, 0, 100 - zone.height)
        onZoneMove(dragZoneId, newX, newY)
        return
      }

      if (drawStart) {
        const rect = getSvgRect()
        if (!rect) return
        setDrawCurrent(clientToPercent(e.clientX, e.clientY, rect))
      }
    },
    [
      isPanning,
      panStart,
      dragZoneId,
      dragOffset,
      drawStart,
      zones,
      getSvgRect,
      onPanChange,
      onZoneMove,
    ]
  )

  // Pointer up
  const handlePointerUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false)
      setPanStart(null)
      return
    }

    if (dragZoneId) {
      setDragZoneId(null)
      setDragOffset(null)
      return
    }

    if (drawStart && drawCurrent) {
      const normalized = normalizeRect(drawStart.x, drawStart.y, drawCurrent.x, drawCurrent.y)
      // Only create zone if it has reasonable size
      if (normalized.width >= 2 && normalized.height >= 2) {
        const newZone: MapZone = {
          id: crypto.randomUUID(),
          label: `Zone ${zones.length + 1}`,
          shape: editMode === 'draw-ellipse' ? 'ellipse' : 'rect',
          ...normalized,
          color: DEFAULT_ZONE_COLOR,
          opacity: DEFAULT_ZONE_OPACITY,
          hasChildLayer: false,
        }
        onZoneCreate(newZone)
      }
    }
    setDrawStart(null)
    setDrawCurrent(null)
  }, [isPanning, dragZoneId, drawStart, drawCurrent, editMode, zones.length, onZoneCreate])

  // Zone pointer-down for drag-move (select mode only)
  const handleZoneDragStart = useCallback(
    (zoneId: string, e: React.PointerEvent) => {
      if (!isMediator || editMode !== 'select') return
      const rect = getSvgRect()
      if (!rect) return
      const zone = zones.find((z) => z.id === zoneId)
      if (!zone) return
      const point = clientToPercent(e.clientX, e.clientY, rect)
      setDragZoneId(zoneId)
      setDragOffset({ x: point.x - zone.x, y: point.y - zone.y })
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      e.stopPropagation()
    },
    [isMediator, editMode, zones, getSvgRect]
  )

  // Zone click handler (different behavior per mode)
  const handleZoneClick = useCallback(
    (zoneId: string) => {
      if (editMode === 'draw-line') {
        if (!lineFromZoneId) {
          onLineFromZoneChange(zoneId)
        } else if (lineFromZoneId !== zoneId) {
          // Check for duplicate connection
          const exists = connections.some(
            (c) =>
              (c.fromZoneId === lineFromZoneId && c.toZoneId === zoneId) ||
              (c.fromZoneId === zoneId && c.toZoneId === lineFromZoneId)
          )
          if (!exists) {
            // Auto-color: match zone colors if same, black if different
            const fromZone = zones.find((z) => z.id === lineFromZoneId)
            const toZone = zones.find((z) => z.id === zoneId)
            const color =
              fromZone && toZone && fromZone.color === toZone.color ? fromZone.color : '#000000'
            onConnectionCreate({
              id: crypto.randomUUID(),
              fromZoneId: lineFromZoneId,
              toZoneId: zoneId,
              color,
            })
          }
          onLineFromZoneChange(null)
        }
        return
      }
      onZoneClick(zoneId)
    },
    [
      editMode,
      lineFromZoneId,
      connections,
      zones,
      onZoneClick,
      onConnectionCreate,
      onLineFromZoneChange,
    ]
  )

  // Draw preview rect/ellipse
  const drawPreview =
    drawStart && drawCurrent
      ? normalizeRect(drawStart.x, drawStart.y, drawCurrent.x, drawCurrent.y)
      : null

  const cursorClass =
    editMode === 'pan'
      ? isPanning
        ? 'cursor-grabbing'
        : 'cursor-grab'
      : editMode === 'draw-rect' || editMode === 'draw-ellipse'
        ? 'cursor-crosshair'
        : editMode === 'draw-line'
          ? 'cursor-cell'
          : dragZoneId
            ? 'cursor-grabbing'
            : 'cursor-default'

  return (
    <div
      ref={containerRef}
      className={`relative h-full overflow-hidden rounded border border-su-grey-light/50 bg-su-dark ${cursorClass}`}
      style={{ touchAction: 'none' }}
      onWheel={handleWheel}
    >
      <div
        className="h-full"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Background image or placeholder */}
        <div className="relative h-full w-full">
          {backgroundUrl ? (
            <img
              src={backgroundUrl}
              alt="Map background"
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-su-dark/80">
              <span className="font-mono text-sm text-su-white/30">
                {isMediator ? 'Click the image icon to set a background' : 'No map background set'}
              </span>
            </div>
          )}

          {/* SVG overlay */}
          <svg
            ref={svgRef}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={(e) => {
              if (e.target === svgRef.current) {
                onCanvasClick()
              }
            }}
          >
            {/* Connections (render behind zones) */}
            {connections.map((conn) => (
              <MapConnectionElement
                key={conn.id}
                connection={conn}
                zones={zones}
                isSelected={selectedConnectionId === conn.id}
                onClick={onConnectionClick}
              />
            ))}

            {/* Zones */}
            {zones.map((zone) => (
              <MapZoneElement
                key={zone.id}
                zone={zone}
                isSelected={selectedZoneId === zone.id}
                isDragging={dragZoneId === zone.id}
                onClick={handleZoneClick}
                onPointerDown={handleZoneDragStart}
              />
            ))}

            {/* Draw preview */}
            {drawPreview &&
              (editMode === 'draw-ellipse' ? (
                <ellipse
                  cx={drawPreview.x + drawPreview.width / 2}
                  cy={drawPreview.y + drawPreview.height / 2}
                  rx={drawPreview.width / 2}
                  ry={drawPreview.height / 2}
                  fill={DEFAULT_ZONE_COLOR}
                  fillOpacity={0.2}
                  stroke={DEFAULT_ZONE_COLOR}
                  strokeWidth={0.3}
                  strokeDasharray="1 0.5"
                  pointerEvents="none"
                />
              ) : (
                <rect
                  x={drawPreview.x}
                  y={drawPreview.y}
                  width={drawPreview.width}
                  height={drawPreview.height}
                  fill={DEFAULT_ZONE_COLOR}
                  fillOpacity={0.2}
                  stroke={DEFAULT_ZONE_COLOR}
                  strokeWidth={0.3}
                  strokeDasharray="1 0.5"
                  pointerEvents="none"
                />
              ))}

            {/* Line-from indicator */}
            {lineFromZoneId &&
              editMode === 'draw-line' &&
              (() => {
                const fromZone = zones.find((z) => z.id === lineFromZoneId)
                if (!fromZone) return null
                return (
                  <circle
                    cx={fromZone.x + fromZone.width / 2}
                    cy={fromZone.y + fromZone.height / 2}
                    r={1}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={0.3}
                    strokeDasharray="0.5 0.3"
                    pointerEvents="none"
                  />
                )
              })()}
          </svg>
        </div>
      </div>
    </div>
  )
}
