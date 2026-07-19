/**
 * Dashboard — the play-surface ("Pit HUD") root for a single mech.
 *
 * Phase 1 (read-only shell): loads the real mech from `entityStore`, lays the
 * locked four-surface grid inside the scale-to-fit canvas, and wires the rail.
 * The Active Item, Dial, and Display are placeholders here; later phases fill
 * them with instruments, the rotary dial, and the SRD reference/actions view.
 * No mutations happen yet.
 *
 * See docs/architecture/play-cockpit.md for the full plan.
 */

import { useCallback, useState } from 'react'

import { Dial, DashboardCanvas, DashboardGrid, RailBar, buttonVariants } from 'component-lib'
import { useWorkspace } from '../../hooks/queries/workspaces'
import type { CockpitPrefs } from '../../lib/schemas/cockpitPrefs'
import { useEntityStore } from '../../stores/entityStore'
import { usePlayStateStore } from '../../stores/playStateStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { resolveSheetComposition } from '../sheet/composition'
import type { EntityLookup } from '../sheet/composition'
import { ActiveItemBand } from './ActiveItemBand'
import { DialConfig } from './DialConfig'
import { applyDialPrefs, configurableKinds, dialItems } from './dialItems'
import { DisplayView } from './DisplayView'
import { DowntimeWizard } from './DowntimeWizard'
import { AppLink } from '../shared/AppLink'

export function Dashboard({ id }: { id: string }) {
  const storeState = useEntityStore()
  // The active-row entity drives the whole-canvas tint (proposed ADR-018).
  const mount = usePlayStateStore((s) => s.mount)
  const wheel = usePlayStateStore((s) => s.wheel)
  const setWheel = usePlayStateStore((s) => s.setWheel)
  const leaveDowntime = usePlayStateStore((s) => s.leaveDowntime)
  const mech = storeState.get('mech', id)

  // Persisted dial prefs live on the owning workspace (local-first, Phase 7).
  // Hooks run unconditionally (before the no-mech early return); when the mech
  // has no workspace, prefs fall back to session-only React state.
  const workspaceId = mech?.workspaceId ?? null
  const workspace = useWorkspace(workspaceId)
  const [sessionPrefs, setSessionPrefs] = useState<CockpitPrefs | undefined>(undefined)
  const prefs = workspace?.cockpitPrefs ?? sessionPrefs
  const setPrefs = useCallback(
    (next: CockpitPrefs) => {
      if (workspaceId) {
        void useWorkspaceStore.getState().update(workspaceId, { cockpitPrefs: next })
      } else {
        setSessionPrefs(next)
      }
    },
    [workspaceId]
  )

  if (!mech) {
    return (
      <DashboardCanvas>
        <DashboardGrid
          rail={<span className="pc-stamp pc-stamp-mech">Mech not found</span>}
          primary={<div className="pc-placeholder">No mech with id “{id}”.</div>}
          display={<div className="pc-fill">—</div>}
          wheel={<div className="pc-placeholder">Dial</div>}
        />
      </DashboardCanvas>
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
  const crawler = composition.crawler
  const isDowntime = mount === 'downtime'
  const onFoot = mount === 'pilot' && pilot !== null
  // Downtime is crawler-dominant: rail, stamp, and Active Item all follow the
  // crawler ontology (pink); otherwise the boarded mech / pilot on foot.
  const fam = isDowntime ? 'crawler' : onFoot ? 'pilot' : 'mech'
  const railTitle = isDowntime
    ? crawler
      ? `Downtime · ${crawler.name}`
      : 'Downtime'
    : onFoot && pilot
      ? `Pilot · ${pilot.name}`
      : `Mech · ${mech.name}`

  // The Dial holds the non-active entities + statless views; the item in the
  // active slot is the display's focus (focus→display sync; content is Phase 4).
  // Persisted prefs (show/hide + order) are applied on top of the base list.
  const items = applyDialPrefs(dialItems({ mount, mech, pilot, crawler }), prefs)
  const cfgKinds = configurableKinds({ pilot, crawler })
  const focus =
    items.length > 0 ? items[((wheel % items.length) + items.length) % items.length] : undefined

  return (
    <DashboardCanvas>
      <DashboardGrid
        mount={mount}
        rail={
          <RailBar
            title={railTitle}
            fam={fam}
            returnControl={
              <AppLink
                href="/"
                className={buttonVariants({ surface: 'instrument', variant: 'ghost', size: 'sm' })}
              >
                ◄ Return to Workspace
              </AppLink>
            }
            onLeaveDowntime={isDowntime ? leaveDowntime : undefined}
          />
        }
        primary={<ActiveItemBand mech={mech} pilot={pilot} crawler={crawler} store={storeState} />}
        displayLight
        display={
          isDowntime ? (
            <DowntimeWizard crawler={crawler} />
          ) : (
            <DisplayView focus={focus} mech={mech} pilot={pilot} crawler={crawler} />
          )
        }
        wheel={
          <Dial
            items={items}
            activeIndex={wheel}
            onActiveIndexChange={setWheel}
            renderConfig={(close) => (
              <DialConfig kinds={cfgKinds} prefs={prefs} onChange={setPrefs} onClose={close} />
            )}
          />
        }
      />
    </DashboardCanvas>
  )
}
