/**
 * Shared props contract for the three per-kind sheet views (audit item 19).
 * Sheet.tsx keeps the store subscription and composition resolution; views
 * receive resolved data + narrow write surfaces so they re-render on their
 * props, not on unrelated store writes.
 */

import type { ReactNode } from 'react'
import type { Crawler } from '../../lib/schemas/crawler'
import type { EntityRef } from '../../lib/schemas/entity'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import type { EntityState, useEntityStore } from '../../stores/entityStore'
import type { EntityLookup, SheetComposition } from './composition'
import type { LiveSheetSegment } from './LiveSheet'

/** The store-state surface the views actually touch (injectable in tests). */
export type SheetStoreState = EntityState

/**
 * A linked unit the viewer may not read — on a public sheet, an assignment
 * whose far end is not published itself (`publicSheet.get` serves its kind and
 * nothing else). The rail shows "Not shared" in its slot: no name, no vitals,
 * no way in. `name` is set only for a published unit whose body this app
 * cannot render. `key` is a render key, not an id.
 */
export type WithheldUnit = { key: string; kind: EntityRef['type']; name?: string }

export type SheetViewCommonProps = {
  composition: SheetComposition
  back: { href: string; label: string }
  /** Top-bar trailing actions; undefined on read-only sheets. */
  actions: ReactNode
  segments?: LiveSheetSegment[]
  editable: boolean
  readOnly: boolean
  /**
   * The viewer may not write the Game's crawler (a player: the Mediator keeps
   * it, ADR-038 §5). Closes the cargo moves and scrap draws that would write
   * it from a pilot's or mech's own sheet; `readOnly` still governs the rest.
   */
  crawlerReadOnly: boolean
  /** Injectable store hook, forwarded to body sheets/controls. */
  store: typeof useEntityStore
  storeState: SheetStoreState
  /**
   * Cross-type read used by mech Push (freshest record) and the rail. It also
   * resolves entities the viewer may read but not edit (a Game's crewmates),
   * so a linked unit found here is not necessarily one this sheet can write.
   */
  lookup: EntityLookup
  /**
   * Whether this sheet's own store holds the entity — i.e. it is one the viewer
   * may edit, and a link drawn out of it is theirs to undraw. False for a
   * crewmate's pilot or mech resolved through `lookup` alone.
   */
  holds: (kind: EntityRef['type'], id: string) => boolean
  /** Where a linked unit's View goes; `undefined` renders no View at all. */
  hrefFor: (kind: EntityRef['type'], id: string) => string | undefined
  /** Linked units to name without reading (public sheets); usually empty. */
  withheld: readonly WithheldUnit[]
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
