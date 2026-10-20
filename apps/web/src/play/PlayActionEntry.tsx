/**
 * PlayActionEntry — one line of the Actions list, whatever it is (play.md
 * §5): a unit's action (`PlayActionRow`), the Reactor (`PlayReactorRow`),
 * Mount (`PlayMountRow`) or a Downtime action (`PlayDowntimeActionRow`).
 * Each is a Mini, one `<li>` a line in the column's list (ruleset §1.3,
 * play.md §12).
 */

import { mechMaxHeat, resolveChassisRef, resolveGauge } from 'salvageunion-reference/rules'
import { PlayActionRow } from './PlayActionRow'
import { PlayDowntimeActionRow } from './PlayDowntimeActionRow'
import { PlayMountRow } from './PlayMountRow'
import { PlayReactorRow } from './PlayReactorRow'
import type { ListEntry } from './playActions.model'
import { lockReason, NEED_TEXT } from './playActions.model'
import type { Play } from './situation.model'
import type { PlayActions } from './usePlayActions'

/** Pilots carry no Heat: an AP action never meets a cap. */
const NO_HEAT = { current: 0, cap: Number.MAX_SAFE_INTEGER }

export function PlayActionEntry({
  entry,
  play,
  actions,
}: {
  entry: ListEntry
  play: Play
  actions: PlayActions
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
              return { current: resolveGauge(fresh.currentHeat, cap), cap }
            })()
          : NO_HEAT
      return (
        <PlayActionRow
          entry={entry}
          resolve={open && resolve.kind === 'resolve' ? resolve : null}
          onUse={() => actions.open(entry.key)}
          canWrite={play.canWrite}
          locked={entry.need === null ? lockReason(entry.action, play.seat.seat.range, heat) : null}
        />
      )
    }
    case 'reactor':
      return actions.mech === null ? null : (
        <PlayReactorRow
          mech={actions.mech}
          store={actions.store}
          rollFor={actions.rollFor}
          need={need}
          canWrite={play.canWrite}
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
          rollFor={actions.rollFor}
          need={need}
          canWrite={play.canWrite}
        />
      )
  }
}
