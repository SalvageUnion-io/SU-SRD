/**
 * PlayCockpitPhone — the player's Play screen below the canvas's floor
 * (play.md §11): `PlayPhone` with the player's tabs.
 *
 *  - **Act** — the Actions column (`PlayActionsColumn`): the flattened list,
 *    resolving inline in its row; in Downtime the step track, the step box and
 *    the Downtime actions.
 *  - **Units** — the Units column (`PlayUnitsColumn`), every − / + on it.
 *  - **Tables** — the Tables and the Feed (`PlayerTablesAndFeed`).
 *  - **Crew** — a Game's other seats (`PlayCrewSection`); solo has no tab.
 *
 * Pinned above them: the live vitals for the Situation (`pinnedUnits`) and
 * the Situation switch, TABLE beside it. In table mode (`useTableMode`) the
 * tabs give way to `PlayTableMode`, which draws those vitals itself at the
 * Full Size, so only the switch stays pinned; the screen stays awake
 * (`useWakeLock`). `usePlaySide` is read here, once, as the canvas's
 * side column reads it, so every roll made on any tab is dispatched whichever
 * tab is open.
 */

import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { tokens } from '../components/index'
import { runWrite } from '../lib/runWrite'
import { useEntityStore } from '../stores/entityStore'
import { PLAY_TXN } from '../stores/surfaceProvenance'
import { PlayActionsColumn } from './PlayActionsColumn'
import { PlayPhone, PlayPinnedVitals } from './PlayPhone'
import { PlayCrewSection, PlayerTablesAndFeed } from './PlaySideColumn'
import { PlaySituationSwitch } from './PlaySituationSwitch'
import { PlayTableMode, TableModeToggle } from './PlayTableMode'
import { PlayUnitsColumn } from './PlayUnitsColumn'
import type { PlayerPhoneTab } from './playPhone.model'
import { pinnedUnits, playerPhoneTabs } from './playPhone.model'
import type { PlayColumnProps } from './situation.model'
import { tableUnits } from './tableMode.model'
import type { PlayActionsDeps } from './usePlayActions'
import { usePlaySide } from './usePlaySide'
import { usePlayUnits } from './usePlayUnits'
import { useTableMode } from './useTableMode'
import { useWakeLock } from './useWakeLock'

/** The Situation switch and TABLE on one line, the switch taking the room. */
const SWITCH_ROW = {
  alignItems: 'center',
  display: 'flex',
  gap: tokens.space[8],
  minWidth: 0,
} satisfies CSSProperties

const SWITCH = { flex: '1 1 0%', minWidth: 0 } satisfies CSSProperties

type PlayCockpitPhoneProps = PlayColumnProps & {
  /** The Play bar, in its phone form. */
  bar: ReactNode
  /** The Act tab's store and dice (a test injects its own). */
  actions?: PlayActionsDeps
}

export function PlayCockpitPhone({ target, play, bar, actions }: PlayCockpitPhoneProps) {
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
  const [table] = useTableMode()
  useWakeLock(table)
  const pilotId = play.pilot?.id ?? null
  const mechId = play.boardedMech?.id ?? null
  const writeVital = (kind: 'pilot' | 'mech', field: string, next: number) => {
    const id = kind === 'pilot' ? pilotId : mechId
    if (id === null) return
    runWrite(() => useEntityStore.getState().update(kind, id, { [field]: next }, PLAY_TXN))
  }

  return (
    <PlayPhone
      bar={bar}
      pinned={
        <>
          {table ? null : <PlayPinnedVitals units={pinned} />}
          <div style={SWITCH_ROW}>
            <div style={SWITCH}>
              <PlaySituationSwitch play={play} fill />
            </div>
            <TableModeToggle />
          </div>
        </>
      }
      tabs={tabs}
      tab={tabs.some((t) => t.value === tab) ? tab : 'act'}
      onTab={setTab}
      focus={
        table ? (
          <PlayTableMode
            units={tableUnits(pinned)}
            live={{ pilot: units.live.pilot, mech: units.live.mech }}
            onWrite={writeVital}
          />
        ) : undefined
      }
      panels={{
        act: <PlayActionsColumn target={target} play={play} {...actions} />,
        units: <PlayUnitsColumn target={target} play={play} />,
        tables: (
          <>
            <PlayerTablesAndFeed target={target} play={play} side={side} />
          </>
        ),
        crew: <PlayCrewSection target={target} play={play} side={side} />,
      }}
    />
  )
}
