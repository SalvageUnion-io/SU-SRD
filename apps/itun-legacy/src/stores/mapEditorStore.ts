import { create } from 'zustand'
import type { MapTier, EditMode, BreadcrumbEntry } from '../components/map/mapTypes'

type MapEditorState = {
  // Navigation
  activeTier: MapTier
  activeParentZoneId: string | null
  breadcrumbs: BreadcrumbEntry[]

  // Editor mode
  editMode: EditMode
  selectedZoneId: string | null
  selectedConnectionId: string | null

  // Drawing in-progress
  drawStart: { x: number; y: number } | null
  drawCurrent: { x: number; y: number } | null

  // Line drawing: first zone clicked
  lineFromZoneId: string | null

  // Viewport
  panOffset: { x: number; y: number }
  zoomLevel: number

  // Actions
  setEditMode: (mode: EditMode) => void
  selectZone: (id: string | null) => void
  selectConnection: (id: string | null) => void
  startDraw: (point: { x: number; y: number }) => void
  updateDraw: (point: { x: number; y: number }) => void
  endDraw: () => void
  setLineFromZone: (id: string | null) => void
  setPan: (offset: { x: number; y: number }) => void
  setZoom: (level: number) => void
  navigateToChild: (zoneId: string, zoneLabel: string) => void
  navigateUp: () => void
  navigateTo: (entry: BreadcrumbEntry) => void
  reset: () => void
}

const INITIAL_STATE = {
  activeTier: 'campaign' as MapTier,
  activeParentZoneId: null as string | null,
  breadcrumbs: [{ tier: 'campaign' as MapTier, parentZoneId: null, label: 'Campaign' }],
  editMode: 'select' as EditMode,
  selectedZoneId: null as string | null,
  selectedConnectionId: null as string | null,
  drawStart: null as { x: number; y: number } | null,
  drawCurrent: null as { x: number; y: number } | null,
  lineFromZoneId: null as string | null,
  panOffset: { x: 0, y: 0 },
  zoomLevel: 1,
}

export const useMapEditorStore = create<MapEditorState>((set, get) => ({
  ...INITIAL_STATE,

  setEditMode: (mode) =>
    set({
      editMode: mode,
      selectedZoneId: null,
      selectedConnectionId: null,
      drawStart: null,
      drawCurrent: null,
      lineFromZoneId: null,
    }),

  selectZone: (id) => set({ selectedZoneId: id, selectedConnectionId: null }),
  selectConnection: (id) => set({ selectedConnectionId: id, selectedZoneId: null }),

  startDraw: (point) => set({ drawStart: point, drawCurrent: point }),
  updateDraw: (point) => set({ drawCurrent: point }),
  endDraw: () => set({ drawStart: null, drawCurrent: null }),

  setLineFromZone: (id) => set({ lineFromZoneId: id }),

  setPan: (offset) => set({ panOffset: offset }),
  setZoom: (level) => set({ zoomLevel: level }),

  navigateToChild: (zoneId, zoneLabel) => {
    const { activeTier, breadcrumbs } = get()
    const childTier = activeTier === 'campaign' ? 'region' : 'area'
    const newEntry: BreadcrumbEntry = {
      tier: childTier as MapTier,
      parentZoneId: zoneId,
      label: zoneLabel,
    }
    set({
      activeTier: childTier as MapTier,
      activeParentZoneId: zoneId,
      breadcrumbs: [...breadcrumbs, newEntry],
      selectedZoneId: null,
      selectedConnectionId: null,
      panOffset: { x: 0, y: 0 },
      zoomLevel: 1,
    })
  },

  navigateUp: () => {
    const { breadcrumbs } = get()
    if (breadcrumbs.length <= 1) return
    const newBreadcrumbs = breadcrumbs.slice(0, -1)
    const parent = newBreadcrumbs[newBreadcrumbs.length - 1]!
    set({
      activeTier: parent.tier,
      activeParentZoneId: parent.parentZoneId,
      breadcrumbs: newBreadcrumbs,
      selectedZoneId: null,
      selectedConnectionId: null,
      panOffset: { x: 0, y: 0 },
      zoomLevel: 1,
    })
  },

  navigateTo: (entry) => {
    const { breadcrumbs } = get()
    const idx = breadcrumbs.findIndex(
      (b) => b.tier === entry.tier && b.parentZoneId === entry.parentZoneId
    )
    if (idx < 0) return
    set({
      activeTier: entry.tier,
      activeParentZoneId: entry.parentZoneId,
      breadcrumbs: breadcrumbs.slice(0, idx + 1),
      selectedZoneId: null,
      selectedConnectionId: null,
      panOffset: { x: 0, y: 0 },
      zoomLevel: 1,
    })
  },

  reset: () => set(INITIAL_STATE),
}))
