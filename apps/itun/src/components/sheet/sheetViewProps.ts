/**
 * Shared props contract for the three per-kind sheet views (audit item 19).
 * Sheet.tsx keeps the store subscription and composition resolution; views
 * receive resolved data + narrow write surfaces so they re-render on their
 * props, not on unrelated store writes.
 */

import type { ReactNode } from 'react'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import type { EntityState, useEntityStore } from '../../stores/entityStore'
import type { EntityLookup, SheetComposition } from './composition'
import type { LiveSheetSegment } from './LiveSheet'

/** The store-state surface the views actually touch (injectable in tests). */
export type SheetStoreState = EntityState

export type SheetViewCommonProps = {
  composition: SheetComposition
  back: { href: string; label: string }
  /** Top-bar trailing actions; undefined on read-only sheets. */
  actions: ReactNode
  segments?: LiveSheetSegment[]
  editable: boolean
  readOnly: boolean
  /** Injectable store hook, forwarded to body sheets/controls. */
  store: typeof useEntityStore
  storeState: SheetStoreState
  /** Cross-type read used by mech Push (freshest record). */
  lookup: EntityLookup
  /** Persist a partial patch on the sheet's own entity (fire-and-forget). */
  patch: SheetPatch
}

/** Fields a sheet patch may set on its own entity. */
export type SheetPatchFields = Partial<Pilot> & Partial<Mech> & Partial<Crawler>

/**
 * Persist a partial patch on the sheet's own entity (fire-and-forget).
 *
 * Accepts either a plain fields object, or an updater `(current) => fields`
 * that receives the FRESHEST store record. Array edits (loadout, abilities,
 * weapons) MUST use the updater form: `store.update` awaits an IndexedDB write
 * before it re-renders, so computing `[...prop.array, x]` from the render-time
 * prop races on rapid clicks and silently drops a selection. The updater reads
 * live in-memory state instead (same guard as SheetPilot's `toggleUsed`).
 */
export type SheetPatch = (
  input: SheetPatchFields | ((current: Pilot | Mech | Crawler) => SheetPatchFields)
) => void
