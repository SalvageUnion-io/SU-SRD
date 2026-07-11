/**
 * PlayCockpit — the Play Cockpit ("Pit HUD") root for a single mech.
 *
 * Phase 1 (read-only shell): loads the real mech from `entityStore`, lays the
 * locked four-surface grid inside the scale-to-fit canvas, and wires the rail.
 * The Active Item, Dial, and Display are placeholders here; later phases fill
 * them with instruments, the rotary dial, and the SRD reference/actions view.
 * No mutations happen yet.
 *
 * See docs/architecture/play-cockpit.md for the full plan.
 */

import { useEntityStore } from '../../stores/entityStore'
import { usePlayStateStore } from '../../stores/playStateStore'
import { resolveSheetComposition } from '../sheet/composition'
import type { EntityLookup } from '../sheet/composition'
import { ActiveItemBand } from './ActiveItemBand'
import { CockpitCanvas } from './CockpitCanvas'
import { RailBar } from './RailBar'

export function PlayCockpit({ id }: { id: string }) {
  const storeState = useEntityStore()
  // The active-row entity drives the whole-canvas tint (proposed ADR-018).
  const mount = usePlayStateStore((s) => s.mount)
  const mech = storeState.get('mech', id)

  if (!mech) {
    return (
      <CockpitCanvas>
        <div className="pc-grid">
          <div className="pc-rail">
            <span className="pc-stamp pc-stamp-mech">Mech not found</span>
          </div>
          <div className="pc-primary">
            <div className="pc-placeholder">No mech with id “{id}”.</div>
          </div>
          <div className="pc-display">
            <div className="pc-fill">—</div>
          </div>
          <div className="pc-wheel">
            <div className="pc-placeholder">Dial</div>
          </div>
        </div>
      </CockpitCanvas>
    )
  }

  // Cast mirrors Sheet.tsx: the store's generic get is compatible with the
  // EntityLookup shape but TS can't align the conditional return types.
  const lookup: EntityLookup = {
    get: (type, entityId) => storeState.get(type, entityId),
  } as EntityLookup
  const composition = resolveSheetComposition({
    kind: 'mech',
    id,
    links: storeState.softLinks,
    store: lookup,
  })
  const pilot = composition.pilot
  const onFoot = mount === 'pilot' && pilot !== null
  const railTitle = onFoot && pilot ? `Pilot · ${pilot.name}` : `Mech · ${mech.name}`

  return (
    <CockpitCanvas>
      <div className="pc-grid" data-mount={mount}>
        <RailBar title={railTitle} fam={onFoot ? 'pilot' : 'mech'} />
        <div className="pc-primary">
          <ActiveItemBand mech={mech} pilot={pilot} />
        </div>
        <div className="pc-display">
          <div className="pc-fill">Main display — SRD reference &amp; actions (Phase 4)</div>
        </div>
        <div className="pc-wheel">
          <div className="pc-placeholder">Dial (Phase 3)</div>
        </div>
      </div>
    </CockpitCanvas>
  )
}
