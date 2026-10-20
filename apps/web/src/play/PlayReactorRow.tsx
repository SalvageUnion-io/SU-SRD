/**
 * PlayReactorRow — the mech's Reactor as a row of the Actions list (play.md
 * §5): the Heat Check on the Reactor Overload table, Push, Vent and Shut
 * down, writing the reactor's patches (`lib/rules/playActions`).
 *
 * The roll is the table's (`PlayRollInstrument`, R8): its stamp is the one
 * roll control, "Heat Check:", or "Push:" while Push is pressed (+2 Heat,
 * then the Heat Check, Core Book p.234); an overload is its marked row and
 * what it came to the line under it. Push is never a second roll button.
 *
 * ADR-007: Push, Heat Check, Vent and Shut down are bookkeeping and apply on
 * one press; a Meltdown's destruction is the player's, behind its own button.
 * A Push that would pass the Heat Capacity is refused and says why (Core Book
 * p.234). Every Heat Check's dice go on Play's roll log with what they came to
 * (`rollFor`, `playRolls.model.ts`: the Feed, the Game's log, Discord); a Vent
 * or a Shut down is an applied change on the Feed (`recordPlayChange`).
 *
 * A Mini one a line in the list (ruleset §1.3; `playLineModel`, the Reactor
 * being no reference entity), its controls in its chip group (R6); the table
 * and the result are its contentful body, plain content (N3, play.md §12).
 * Not on hand, it is its head alone, the need its chip.
 */

import type { Mech } from 'game-domain/schemas/mech'
import { useState } from 'react'
import {
  canPush,
  mechMaxHeat,
  mechMaxSP,
  resolveChassisRef,
  resolveGauge,
  resolvePoolStart,
} from 'salvageunion-reference/rules'
import { Button, Entity, Toggle } from '../components/index'
import {
  describeHeatCheck,
  heatCheckOncePatch,
  mechPush,
  shutdownTogglePatch,
  VENT_PATCH,
} from '../lib/rules/playActions'
import { runWrite } from '../lib/runWrite'
import { PLAY_TXN } from '../stores/surfaceProvenance'
import { NeedChip } from './PlayActionRow'
import { PlayRollInstrument } from './PlayRollInstrument'
import type { PlayStore } from './play.model'
import { playLineModel } from './playLine.model'
import { recordPlayChange } from './playRolls.model'
import type { PlayActions } from './usePlayActions'

/** What the last roll or act came to; `overloadRoll` marks the table. */
type ReactorLog = { text: string; meltdown: boolean; overloadRoll?: number }

/** The table a Heat Check overloads on. */
const REACTOR_OVERLOAD = 'Reactor Overload'

const MODEL = playLineModel({ name: 'Reactor', key: 'reactor' })

type PlayReactorRowProps = {
  mech: Mech
  store: PlayStore
  rollFor: PlayActions['rollFor']
  /** Why it is not on hand ("needs Boarded"), or null when it is. */
  need: string | null
  canWrite: boolean
}

export function PlayReactorRow({ mech, store, rollFor, need, canWrite }: PlayReactorRowProps) {
  const [log, setLog] = useState<ReactorLog | null>(null)
  // Push pressed: the stamp's next roll is a Push.
  const [pushing, setPushing] = useState(false)
  const fresh = () => store.get('mech', mech.id) ?? mech
  const chassis = resolveChassisRef(mech.chassisRef)
  const now = fresh()
  const cap = mechMaxHeat(now, chassis)
  const heat = resolveGauge(now.currentHeat, cap)
  const pushLocked = !canPush(heat, cap)
  const away = need !== null
  const off = !canWrite || away

  async function doPush() {
    setPushing(false)
    // What the Push came to, read by the roll log once the dice are.
    let said: string | undefined
    const roll = await rollFor(REACTOR_OVERLOAD, 'Push', {
      plainD20s: 1,
      outcome: () => said,
    })
    const pushed = mechPush(fresh(), roll)
    if (pushed === null) return
    const { patch, text, meltdown, overloadRoll } = pushed
    said = text
    runWrite(
      () => store.update('mech', mech.id, patch, PLAY_TXN),
      () => setLog({ text, meltdown, ...(overloadRoll === undefined ? {} : { overloadRoll }) })
    )
  }

  async function doHeatCheck() {
    let said: string | undefined
    const roll = await rollFor(REACTOR_OVERLOAD, 'Heat Check', {
      plainD20s: 1,
      outcome: () => said,
    })
    const m = fresh()
    const mcap = mechMaxHeat(m, chassis)
    const { patch, effect, meltdown } = heatCheckOncePatch({
      heat: resolveGauge(m.currentHeat, mcap),
      currentSP: resolvePoolStart(m.currentSP, mechMaxSP(m, chassis)),
      roll,
    })
    const text = describeHeatCheck(effect)
    const { overloadRoll } = effect.result
    said = text
    runWrite(
      () => store.update('mech', mech.id, patch, PLAY_TXN),
      () => setLog({ text, meltdown, ...(overloadRoll === undefined ? {} : { overloadRoll }) })
    )
  }

  function doVent() {
    const before = resolveGauge(fresh().currentHeat, cap)
    runWrite(
      () => store.update('mech', mech.id, VENT_PATCH, PLAY_TXN),
      () => {
        setLog({
          text: 'Vented: Heat 0, Vulnerable. Shut down separately if needed.',
          meltdown: false,
        })
        recordPlayChange(`Vent · Heat ${before}→0, Vulnerable`)
      }
    )
  }

  function doShutdown() {
    const shutting = fresh().shutdown !== true
    runWrite(
      () => store.update('mech', mech.id, shutdownTogglePatch(fresh().shutdown), PLAY_TXN),
      () => recordPlayChange(`${shutting ? 'Shut down' : 'Restart'} · ${mech.name}`)
    )
  }

  function confirmMeltdown() {
    runWrite(
      () => store.update('mech', mech.id, { destroyed: true }, PLAY_TXN),
      () => setLog(null)
    )
  }

  function togglePush() {
    if (!pushing && pushLocked) {
      setLog({
        text: `No Push at Heat ${heat}/${cap}: +2 Heat would pass the Heat Capacity. Vent or take a Heat Check first.`,
        meltdown: false,
      })
      return
    }
    setPushing(!pushing)
  }

  const controls = away ? undefined : (
    <>
      <Toggle
        size="mini"
        onClick={togglePush}
        disabled={off}
        pressed={pushing}
        title={pushLocked ? `No Push at Heat ${heat}/${cap}` : '+2 Heat, then the Heat Check'}
      >
        Push
      </Toggle>
      <Button size="mini" onClick={doVent} disabled={off}>
        Vent
      </Button>
      <Toggle size="mini" onClick={doShutdown} disabled={off} pressed={now.shutdown === true}>
        {now.shutdown === true ? 'Restart' : 'Shut down'}
      </Toggle>
    </>
  )

  return (
    <li className="su-play-act" data-away={away || undefined} data-action-key="reactor">
      <Entity
        size="mini"
        context="play"
        model={MODEL}
        dim={away}
        {...(away ? { state: <NeedChip need={need} /> } : { controls })}
        {...(away
          ? {}
          : {
              body: {
                text: false,
                children: (
                  <div className="su-play-resolve">
                    <PlayRollInstrument
                      table={REACTOR_OVERLOAD}
                      roll={log?.overloadRoll ?? null}
                      stamp={pushing ? 'Push:' : 'Heat Check:'}
                      onRoll={off ? undefined : () => void (pushing ? doPush() : doHeatCheck())}
                    />
                    {log ? (
                      <p className="su-play-resolve__note" aria-live="polite">
                        {log.text}
                      </p>
                    ) : null}
                    {log?.meltdown && (
                      <Button variant="primary" size="compact" onClick={confirmMeltdown}>
                        Confirm Meltdown — Mark Mech destroyed
                      </Button>
                    )}
                  </div>
                ),
              },
            })}
      />
    </li>
  )
}
