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

import { buttonVariants, DashboardCanvas, DashboardGrid, Dial, RailBar } from 'component-lib'
import { useCallback, useMemo } from 'react'
import { containerOf } from '../../lib/container'
import type { CockpitPrefs } from '../../lib/schemas/cockpitPrefs'
import { parseContainer, serializeContainer } from '../../stores/activeContainerStore'
import { setCockpitPrefs, useCockpitPrefs } from '../../stores/cockpitPrefsStore'
import { useEntityStore } from '../../stores/entityStore'
import { usePlayStateStore } from '../../stores/playStateStore'
import { AppLink } from '../shared/AppLink'
import type { EntityLookup } from '../sheet/composition'
import { resolveSheetComposition } from '../sheet/composition'
import { ActiveItemBand } from './ActiveItemBand'
import { DialConfig } from './DialConfig'
import { DisplayPanel } from './DisplayPanel'
import { DowntimeWizard } from './DowntimeWizard'
import { applyDialPrefs, configurableKinds, dialItems } from './dialItems'

export function Dashboard({ id }: { id: string }) {
  const storeState = useEntityStore()
  // The active-row entity drives the whole-canvas tint (proposed ADR-018).
  const mount = usePlayStateStore((s) => s.mount)
  const wheel = usePlayStateStore((s) => s.wheel)
  const setWheel = usePlayStateStore((s) => s.setWheel)
  const leaveDowntime = usePlayStateStore((s) => s.leaveDowntime)
  const mech = storeState.get('mech', id)

  // Persisted dial prefs are scoped to the mech's container (ADR-030 §2) and
  // kept in localStorage — see cockpitPrefsStore for why neither container is
  // the right record to hang them off. Hooks run unconditionally, before the
  // no-mech early return, so `containerOf` is fed a stand-in when there is no
  // mech yet; nothing reads those prefs in that state.
  //
  // `containerOf` mints a fresh object every render, so it is round-tripped
  // through its serialized form to get a value that is stable while the mech's
  // container is — otherwise `setPrefs` would change identity on every render
  // and defeat every memo below it.
  const containerKey = serializeContainer(containerOf(mech ?? {}))
  const container = useMemo(() => parseContainer(containerKey), [containerKey])
  const prefs = useCockpitPrefs(container)
  const setPrefs = useCallback(
    (next: CockpitPrefs) => {
      setCockpitPrefs(container, next)
    },
    [container]
  )

  if (!mech) {
    return (
      <DashboardCanvas>
        <DashboardGrid
          rail={<span>Mech not found</span>}
          primary={<div className="pc-placeholder">No mech with id “{id}”.</div>}
          display={<div className="pc-fill">—</div>}
          wheel={<div className="pc-placeholder">Dial</div>}
        />
      </DashboardCanvas>
    )
  }

  const lookup: EntityLookup = {
    get: (type, entityId) => storeState.get(type, entityId),
  }
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
                className={buttonVariants({
                  surface: 'instrument',
                  variant: 'ghost',
                  size: 'compact',
                })}
              >
                ◄ Return to Roster
              </AppLink>
            }
            onLeaveDowntime={isDowntime ? leaveDowntime : undefined}
          />
        }
        primary={<ActiveItemBand mech={mech} pilot={pilot} crawler={crawler} store={storeState} />}
        display={
          isDowntime ? (
            <DowntimeWizard crawler={crawler} mech={mech} pilot={pilot} />
          ) : (
            <DisplayPanel focus={focus} mech={mech} pilot={pilot} crawler={crawler} />
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
