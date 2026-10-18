/**
 * PlayCockpitPhone — the player's Play screen below the canvas's floor
 * (play.md §11, wireframe phone): `PlayPhone` with the player's tabs.
 *
 *  - **Act** — the Actions column (`PlayActionsColumn`): the flattened list,
 *    resolving inline in its row; in Downtime the step track, the step box and
 *    the Downtime actions.
 *  - **Units** — the Units column (`PlayUnitsColumn`), every − / + on it.
 *  - **Tables** — the Tables and the Feed (`PlayTablesSection`,
 *    `PlayFeedSection`).
 *  - **Crew** — a Game's other seats (`PlayCrewSection`); solo has no tab.
 *
 * Pinned above them: the live vitals for the Situation (`pinnedUnits`) and
 * the Situation switch. `usePlaySide` is read here, once, as the canvas's
 * side column reads it, so every roll made on any tab is dispatched whichever
 * tab is open.
 */

import type { ReactNode } from 'react'
import { useState } from 'react'
import { PlayActionsColumn } from './PlayActionsColumn'
import { PlayPhone, PlayPinnedVitals } from './PlayPhone'
import { PlayCrewSection, PlayFeedSection, PlayTablesSection } from './PlaySideColumn'
import { PlaySituationSwitch } from './PlaySituationSwitch'
import { PlayUnitsColumn } from './PlayUnitsColumn'
import type { PlayerPhoneTab } from './playPhone.model'
import { pinnedUnits, playerPhoneTabs } from './playPhone.model'
import type { PlayColumnProps } from './situation.model'
import type { PlayActionsDeps } from './usePlayActions'
import { usePlaySide } from './usePlaySide'
import { usePlayUnits } from './usePlayUnits'

type PlayCockpitPhoneProps = PlayColumnProps & {
  /** The Play bar, in its phone form. */
  bar: ReactNode
  /** In place of the Situation switch. */
  situation?: ReactNode
  /** The Act tab's store and dice (a test injects its own). */
  actions?: PlayActionsDeps
}

export function PlayCockpitPhone({ target, play, bar, situation, actions }: PlayCockpitPhoneProps) {
  const [tab, setTab] = useState<PlayerPhoneTab>('act')
  const side = usePlaySide({ target, play })
  const units = usePlayUnits(play)
  const solo = target.gameId === null
  const pinned = pinnedUnits({
    situation: play.situation,
    pilot: play.pilot,
    crawler: units.crawler?.crawler ?? null,
    boardedMech: play.boardedMech,
    activeEffects: play.seat.seat.activeEffects,
  })
  const tabs = playerPhoneTabs(solo)

  return (
    <PlayPhone
      bar={bar}
      pinned={
        <>
          <PlayPinnedVitals units={pinned} />
          {situation ?? <PlaySituationSwitch play={play} fill />}
        </>
      }
      tabs={tabs}
      tab={tabs.some((t) => t.value === tab) ? tab : 'act'}
      onTab={setTab}
      panels={{
        act: <PlayActionsColumn target={target} play={play} {...actions} />,
        units: <PlayUnitsColumn target={target} play={play} />,
        tables: (
          <>
            <PlayTablesSection target={target} play={play} side={side} />
            <PlayFeedSection target={target} play={play} side={side} />
          </>
        ),
        crew: <PlayCrewSection target={target} play={play} side={side} />,
      }}
    />
  )
}
