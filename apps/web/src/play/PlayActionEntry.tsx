/**
 * PlayActionEntry — one line of the Actions list, whatever it is (play.md
 * §5): a unit's action (`PlayActionRow`), the Reactor (`PlayReactorRow`),
 * Mount (`PlayMountRow`) or a Downtime action (`PlayDowntimeActionRow`).
 * Each is a Mini, one `<li>` a line in the column's list (ruleset §1.3,
 * play.md §12).
 */

import { mechHasCondition } from 'game-domain/rules/crewStatus'
import { mechMaxHeat, resolveChassisRef, resolveGauge } from 'salvageunion-reference/rules'
import { playCopy } from '../messages/play'
import { actionUsesLeft } from './deckActivation.model'
import { PlayActionRow } from './PlayActionRow'
import { PlayDowntimeActionRow } from './PlayDowntimeActionRow'
import { PlayMountRow } from './PlayMountRow'
import { PlayReactorRow } from './PlayReactorRow'
import type { ListEntry } from './playActions.model'
import { lockReason, NEED_TEXT } from './playActions.model'
import type { Play } from './situation.model'
import type { PlayActions } from './usePlayActions'
import { isDown } from './zeroVital.model'

/** Pilots carry no Heat: an AP action never meets a cap. */
const NO_HEAT = { current: 0, cap: Number.MAX_SAFE_INTEGER }

export function PlayActionEntry({
  entry,
  play,
  actions,
  grouped = false,
  moment,
}: {
  entry: ListEntry
  play: Play
  actions: PlayActions
  /** The list sits under an action type's heading: a unit's action leaves its type out (C10). */
  grouped?: boolean
  /** It is the Main display's beat (ADR-068): an action draws as the Moment. */
  moment?: { onList?: (() => void) | undefined } | undefined
}) {
  const need = entry.need === null ? null : NEED_TEXT[entry.need]
  switch (entry.kind) {
    case 'action': {
      const { resolve } = actions
      const open =
        resolve.kind === 'resolve' && actions.resolvingKey === entry.key && entry.need === null
      const mech = actions.mech
      const heat =
        entry.action.currency === 'EP' && mech !== null
          ? (() => {
              const fresh = actions.store.get('mech', mech.id) ?? mech
              const cap = mechMaxHeat(fresh, resolveChassisRef(fresh.chassisRef))
              return {
                current: resolveGauge(fresh.currentHeat, cap),
                cap,
                scale: actions.heatScale,
              }
            })()
          : NO_HEAT
      // A Down Mech's own actions are not offered (r6 A7): Down, and the way back.
      const mechDown =
        entry.source === 'mech' &&
        mech !== null &&
        isDown((actions.store.get('mech', mech.id) ?? mech).currentSP)
      // A Shut down Mech's own actions need the power it has not (r7 B2).
      const mechShut =
        entry.source === 'mech' &&
        mech !== null &&
        mechHasCondition(actions.store.get('mech', mech.id) ?? mech, 'Shutdown')
      return (
        <PlayActionRow
          entry={entry}
          unpowered={mechShut ? playCopy('shutDown') : null}
          resolve={open && resolve.kind === 'resolve' ? resolve : null}
          done={actions.doneKey === entry.key}
          doneSays={actions.doneSays}
          onUse={() => actions.open(entry.key)}
          canWrite={play.canWrite}
          techLevel={actions.crawlerTechLevel}
          grouped={grouped}
          uses={actionUsesLeft(
            {
              store: actions.store,
              pilot: actions.pilot,
              mech: actions.mech,
              crawler: actions.crawler,
            },
            entry.action
          )}
          locked={
            mechDown
              ? playCopy('mechDownLock')
              : entry.need === null
                ? lockReason(entry.action, play.seat.seat.range, heat, actions.closeOnly)
                : null
          }
          unavailable={mechDown}
          moment={moment}
        />
      )
    }
    case 'reactor':
      return actions.mech === null ? null : (
        <PlayReactorRow
          mech={actions.mech}
          pilot={actions.pilot}
          crawler={actions.crawler}
          store={actions.store}
          rollFor={actions.rollFor}
          need={need}
          canWrite={play.canWrite}
          heatScale={actions.heatScale}
        />
      )
    case 'mount':
      return <PlayMountRow play={play} need={need} />
    case 'downtime':
      return (
        <PlayDowntimeActionRow
          id={entry.id}
          name={entry.name}
          pilot={actions.pilot}
          crawler={actions.crawler}
          mech={actions.mech}
          store={actions.store}
          rollFor={actions.rollFor}
          need={need}
          canWrite={play.canWrite}
          solo={play.target.gameId === null}
        />
      )
  }
}
