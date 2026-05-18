import { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { useGame, useGameMembers } from '../../hooks/useGames'
import {
  useMapLayer,
  useUpsertMapLayer,
  useUpdateMapLayer,
  mapKeys,
} from '../../hooks/useMapLayers'
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription'
import { useMapEditorStore } from '../../stores/mapEditorStore'
import { isMediator } from '../../lib/gameUtils'
import { getErrorMessage } from '../../lib/errors'
import { PageSkeleton } from '../shared/PageSkeleton'
import { NotFoundState } from '../shared/NotFoundState'
import { MapCanvas } from './MapCanvas'
import { MapToolbar } from './MapToolbar'
import { MapLegend } from './MapLegend'
import { MapBreadcrumbs } from './MapBreadcrumbs'
import { ZoneEditorPanel } from './ZoneEditorPanel'
import { ConnectionEditorPanel } from './ConnectionEditorPanel'
import { BackgroundUploadDialog } from './BackgroundUploadDialog'
import { mapZonesSchema, mapConnectionsSchema } from './mapTypes'
import { CHILD_TIER } from './mapConstants'
import type { MapZone, MapConnection } from './mapTypes'
import type { Json } from '../../types/database-generated.types'

type MapPageProps = {
  gameId: string
}

export function MapPage({ gameId }: MapPageProps) {
  const user = useCurrentUser()
  const { data: game, isLoading: gameLoading } = useGame(gameId)
  const { data: members, isLoading: membersLoading } = useGameMembers(gameId)

  const {
    activeTier,
    activeParentZoneId,
    breadcrumbs,
    editMode,
    selectedZoneId,
    selectedConnectionId,
    lineFromZoneId,
    panOffset,
    zoomLevel,
    setEditMode,
    selectZone,
    selectConnection,
    setLineFromZone,
    setPan,
    setZoom,
    navigateToChild,
    navigateTo,
  } = useMapEditorStore()

  const { data: layer, isLoading: layerLoading } = useMapLayer(
    gameId,
    activeTier,
    activeParentZoneId
  )

  // Realtime sync
  useRealtimeSubscription('map_layers', `campaign_id=eq.${gameId}`, [
    mapKeys.forCampaign(gameId),
    mapKeys.layer(gameId, activeTier, activeParentZoneId),
  ])

  const upsertLayer = useUpsertMapLayer()
  const updateLayer = useUpdateMapLayer()

  const [bgDialogOpen, setBgDialogOpen] = useState(false)

  // Debounce ref for zone moves — only persist on pointer-up
  const pendingMoveRef = useRef<{ zoneId: string; x: number; y: number } | null>(null)

  const isMed = useMemo(
    () => (members ? isMediator(members, user?.id ?? '') : false),
    [members, user?.id]
  )

  // Parse JSONB zones/connections with Zod validation
  const zones = useMemo<MapZone[]>(() => {
    if (!layer?.zones) return []
    const result = mapZonesSchema.safeParse(layer.zones)
    return result.success ? result.data : []
  }, [layer])

  const connections = useMemo<MapConnection[]>(() => {
    if (!layer?.connections) return []
    const result = mapConnectionsSchema.safeParse(layer.connections)
    return result.success ? result.data : []
  }, [layer])

  // Local zone state for smooth drag rendering
  const [localZoneOverrides, setLocalZoneOverrides] = useState<
    Record<string, { x: number; y: number }>
  >({})

  const displayZones = useMemo<MapZone[]>(
    () =>
      zones.map((z) => {
        const override = localZoneOverrides[z.id]
        return override ? { ...z, x: override.x, y: override.y } : z
      }),
    [zones, localZoneOverrides]
  )

  const selectedZone = useMemo(
    () => displayZones.find((z) => z.id === selectedZoneId) ?? null,
    [displayZones, selectedZoneId]
  )

  const selectedConnection = useMemo(
    () => connections.find((c) => c.id === selectedConnectionId) ?? null,
    [connections, selectedConnectionId]
  )

  // Save helper: ensures layer exists (upsert), then updates zones/connections
  const saveLayer = useCallback(
    (newZones: MapZone[], newConnections: MapConnection[]) => {
      if (!user) return
      if (layer) {
        updateLayer.mutate(
          {
            layerId: layer.id,
            input: {
              zones: newZones as unknown as Json,
              connections: newConnections as unknown as Json,
            },
          },
          { onError: (err) => toast.error(getErrorMessage(err)) }
        )
      } else {
        upsertLayer.mutate(
          {
            campaign_id: gameId,
            tier: activeTier,
            parent_zone_id: activeParentZoneId,
            user_id: user.id,
            zones: newZones as unknown as Json,
            connections: newConnections as unknown as Json,
          },
          { onError: (err) => toast.error(getErrorMessage(err)) }
        )
      }
    },
    [user, layer, gameId, activeTier, activeParentZoneId, updateLayer, upsertLayer]
  )

  const handleZoneCreate = useCallback(
    (zone: MapZone) => {
      const newZones = [...zones, zone]
      saveLayer(newZones, connections)
    },
    [zones, connections, saveLayer]
  )

  const handleZoneUpdate = useCallback(
    (updated: MapZone) => {
      const newZones = zones.map((z) => (z.id === updated.id ? updated : z))
      saveLayer(newZones, connections)
    },
    [zones, connections, saveLayer]
  )

  const handleZoneDelete = useCallback(
    (zoneId: string) => {
      const newZones = zones.filter((z) => z.id !== zoneId)
      const newConns = connections.filter((c) => c.fromZoneId !== zoneId && c.toZoneId !== zoneId)
      selectZone(null)
      saveLayer(newZones, newConns)
    },
    [zones, connections, selectZone, saveLayer]
  )

  // Zone move: update local state immediately for smooth drag, persist on pointer-up
  const handleZoneMove = useCallback((zoneId: string, x: number, y: number) => {
    pendingMoveRef.current = { zoneId, x, y }
    setLocalZoneOverrides((prev) => ({ ...prev, [zoneId]: { x, y } }))
  }, [])

  // Persist pending move when canvas pointer-up fires (via onCanvasClick or zone click)
  const flushPendingMove = useCallback(() => {
    const pending = pendingMoveRef.current
    if (pending) {
      const zone = zones.find((z) => z.id === pending.zoneId)
      if (zone) {
        const newZones = zones.map((z) =>
          z.id === pending.zoneId ? { ...z, x: pending.x, y: pending.y } : z
        )
        saveLayer(newZones, connections)
      }
      pendingMoveRef.current = null
    }
    setLocalZoneOverrides({})
  }, [zones, connections, saveLayer])

  const handleConnectionCreate = useCallback(
    (connection: MapConnection) => {
      const newConns = [...connections, connection]
      saveLayer(zones, newConns)
    },
    [zones, connections, saveLayer]
  )

  const handleConnectionUpdate = useCallback(
    (updated: MapConnection) => {
      const newConns = connections.map((c) => (c.id === updated.id ? updated : c))
      saveLayer(zones, newConns)
    },
    [zones, connections, saveLayer]
  )

  const handleConnectionDelete = useCallback(
    (connectionId: string) => {
      const newConns = connections.filter((c) => c.id !== connectionId)
      selectConnection(null)
      saveLayer(zones, newConns)
    },
    [zones, connections, selectConnection, saveLayer]
  )

  const handleBackgroundSave = useCallback(
    (url: string | null) => {
      if (!user) return
      if (layer) {
        updateLayer.mutate(
          { layerId: layer.id, input: { background_url: url } },
          { onError: (err) => toast.error(getErrorMessage(err)) }
        )
      } else {
        upsertLayer.mutate(
          {
            campaign_id: gameId,
            tier: activeTier,
            parent_zone_id: activeParentZoneId,
            user_id: user.id,
            background_url: url,
          },
          { onError: (err) => toast.error(getErrorMessage(err)) }
        )
      }
    },
    [user, layer, gameId, activeTier, activeParentZoneId, updateLayer, upsertLayer]
  )

  const handleZoneClick = useCallback(
    (zoneId: string) => {
      flushPendingMove()
      if (editMode === 'select' && isMed) {
        selectZone(zoneId)
      } else if (!isMed) {
        const zone = zones.find((z) => z.id === zoneId)
        if (zone && CHILD_TIER[activeTier]) {
          navigateToChild(zoneId, zone.label)
        }
      }
    },
    [editMode, isMed, zones, activeTier, selectZone, navigateToChild, flushPendingMove]
  )

  const handleDrillDown = useCallback(() => {
    if (!selectedZone || !CHILD_TIER[activeTier]) return
    if (!selectedZone.hasChildLayer) {
      handleZoneUpdate({ ...selectedZone, hasChildLayer: true })
    }
    selectZone(null)
    navigateToChild(selectedZone.id, selectedZone.label)
  }, [selectedZone, activeTier, handleZoneUpdate, selectZone, navigateToChild])

  const handleCanvasClick = useCallback(() => {
    flushPendingMove()
    selectZone(null)
    selectConnection(null)
    setLineFromZone(null)
  }, [selectZone, selectConnection, setLineFromZone, flushPendingMove])

  if (gameLoading || membersLoading || layerLoading) return <PageSkeleton />
  if (!game) return <NotFoundState message="Game not found." />

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col gap-2">
      {/* Header row: back + title + breadcrumbs + toolbar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="flex items-center gap-2">
          <Link
            to="/games/$gameId"
            params={{ gameId }}
            className="text-su-white/60 hover:text-su-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-bold text-su-pink">{game.name}</h1>
          <span className="font-mono text-xs uppercase text-su-white/50">Map</span>
        </div>
        <MapBreadcrumbs breadcrumbs={breadcrumbs} onNavigate={navigateTo} />
        {isMed && (
          <MapToolbar
            editMode={editMode}
            onModeChange={setEditMode}
            onBackgroundClick={() => setBgDialogOpen(true)}
          />
        )}
      </div>

      {/* Map area: canvas fills remaining height, legend + editor panels overlaid */}
      <div className="relative min-h-0 flex-1">
        {/* Canvas takes full space */}
        <MapCanvas
          backgroundUrl={layer?.background_url ?? null}
          zones={displayZones}
          connections={connections}
          editMode={isMed ? editMode : 'select'}
          selectedZoneId={selectedZoneId}
          selectedConnectionId={selectedConnectionId}
          lineFromZoneId={lineFromZoneId}
          panOffset={panOffset}
          zoomLevel={zoomLevel}
          isMediator={isMed}
          onZoneClick={handleZoneClick}
          onConnectionClick={(id) => isMed && selectConnection(id)}
          onZoneCreate={handleZoneCreate}
          onZoneMove={handleZoneMove}
          onConnectionCreate={handleConnectionCreate}
          onPanChange={setPan}
          onZoomChange={setZoom}
          onLineFromZoneChange={setLineFromZone}
          onCanvasClick={handleCanvasClick}
        />

        {/* Legend: top-right overlay */}
        <div className="absolute right-2 top-2 z-10">
          <MapLegend tier={activeTier} />
        </div>

        {/* Editor panels: bottom-left overlay */}
        {isMed && selectedZone && (
          <div className="absolute bottom-2 left-2 z-10 w-60">
            <ZoneEditorPanel
              zone={selectedZone}
              onUpdate={handleZoneUpdate}
              onDelete={handleZoneDelete}
              onClose={() => selectZone(null)}
              canDrillDown={!!CHILD_TIER[activeTier]}
              onDrillDown={handleDrillDown}
            />
          </div>
        )}

        {isMed && selectedConnection && (
          <div className="absolute bottom-2 left-2 z-10 w-60">
            <ConnectionEditorPanel
              connection={selectedConnection}
              onUpdate={handleConnectionUpdate}
              onDelete={handleConnectionDelete}
              onClose={() => selectConnection(null)}
            />
          </div>
        )}

        {/* Hint text: bottom-center overlay */}
        {isMed && (
          <div className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded bg-su-dark/80 px-3 py-1 font-mono text-xs text-su-white/40">
            {editMode === 'draw-rect' && 'Click and drag to draw a rectangular zone.'}
            {editMode === 'draw-ellipse' && 'Click and drag to draw an elliptical zone.'}
            {editMode === 'draw-line' &&
              (lineFromZoneId
                ? 'Click a second zone to create a connection.'
                : 'Click a zone to start drawing a connection.')}
            {editMode === 'select' && 'Click to select. Drag to move.'}
            {editMode === 'pan' && 'Click and drag to pan. Scroll to zoom.'}
          </div>
        )}
      </div>

      {/* Background upload dialog */}
      {user && (
        <BackgroundUploadDialog
          open={bgDialogOpen}
          onOpenChange={setBgDialogOpen}
          currentUrl={layer?.background_url ?? null}
          userId={user.id}
          onSave={handleBackgroundSave}
        />
      )}
    </div>
  )
}
