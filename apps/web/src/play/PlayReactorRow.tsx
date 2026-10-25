/**
 * PlayReactorRow — the mech's Reactor as a row of the Actions list (play.md
 * §5): the Heat Check on the Reactor Overload table, Push, Vent and Shut
 * down, writing the reactor's patches (`lib/rules/actionPatches`).
 *
 * The roll is the table's (`PlayRollInstrument`, R8): its stamp is the one
 * roll control, "Heat Check:", or "Push:" while Push is pressed (+2 Heat,
 * then the Heat Check, Core Book p.234; the Scene's conditions scale it:
 * `heatScale`); an overload is its marked row and
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

import { pushHeatAt } from 'game-domain/rules/sceneConditions'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { useState } from 'react'
import type { HeatCheckEffect } from 'salvageunion-reference/rules'
import {
  canPush,
  mechMaxHeat,
  mechMaxSP,
  overloadTableName,
  overloadTableOf,
  resolveChassisRef,
  resolveGauge,
  resolvePoolStart,
} from 'salvageunion-reference/rules'
import { Button, Entity, Toggle } from '../components/index'
import {
  describeHeatCheck,
  heatCheckOncePatch,
  mechPush,
  pilotOverloadPatch,
  shutdownTogglePatch,
  VENT_PATCH,
} from '../lib/rules/actionPatches'
import { runWrite } from '../lib/runWrite'
import { playCopy } from '../messages/play'
import { PLAY_TXN } from '../replica/provenance'
import { NeedChip } from './PlayActionRow'
import { PlayRollInstrument } from './PlayRollInstrument'
import type { PlayStore } from './play.model'
import { playLineModel } from './playLine.model'
import { recordPlayChange } from './playRolls.model'
import type { PlayActions } from './usePlayActions'

/** What the last roll or act came to; `overloadRoll` marks the table. */
type ReactorLog = { text: string; meltdown: boolean; overloadRoll?: number }

const MODEL = playLineModel({ name: 'Reactor', key: 'reactor' })

type PlayReactorRowProps = {
  mech: Mech
  /** The pilot aboard, whom a Bio-Chassis's overload can hurt (WWHF p.79). */
  pilot: Pilot | null
  store: PlayStore
  rollFor: PlayActions['rollFor']
  /** Why it is not on hand ("needs Boarded"), or null when it is. */
  need: string | null
  canWrite: boolean
  /** What the Scene's conditions multiply Heat gained by (`sceneHeatScale`); 1 by default. */
  heatScale?: number
}

export function PlayReactorRow({
  mech,
  pilot,
  store,
  rollFor,
  need,
  canWrite,
  heatScale = 1,
}: PlayReactorRowProps) {
  const [log, setLog] = useState<ReactorLog | null>(null)
  // Push pressed: the stamp's next roll is a Push.
  const [pushing, setPushing] = useState(false)
  const fresh = () => store.get('mech', mech.id) ?? mech
  const chassis = resolveChassisRef(mech.chassisRef)
  // A Bio-Chassis overloads on its own table (We Were Here First p.79).
  const overloadTable = overloadTableOf(chassis)
  const overloadTableTitle = overloadTableName(overloadTable)
  const now = fresh()
  const cap = mechMaxHeat(now, chassis)
  const heat = resolveGauge(now.currentHeat, cap)
  const pushHeat = pushHeatAt(heatScale)
  const pushLocked = !canPush(heat, cap, pushHeat)
  const away = need !== null
  const off = !canWrite || away

  async function doPush() {
    setPushing(false)
    // What the Push came to, read by the roll log once the dice are.
    let said: string | undefined
    const roll = await rollFor(overloadTableTitle, 'Push', {
      plainD20s: 1,
      outcome: () => said,
    })
    const pushed = mechPush(fresh(), roll, heatScale)
    if (pushed === null) return
    const { patch, text, meltdown, overloadRoll, effect } = pushed
    said = text
    runWrite(
      () => store.update('mech', mech.id, patch, PLAY_TXN),
      () => {
        setLog({ text, meltdown, ...(overloadRoll === undefined ? {} : { overloadRoll }) })
        hurtPilot(effect)
      }
    )
  }

  /** A Bio-Chassis overload's harm to the pilot aboard, written to the pilot. */
  function hurtPilot(effect: HeatCheckEffect) {
    if (pilot === null) return
    const patch = pilotOverloadPatch(store.get('pilot', pilot.id) ?? pilot, effect)
    if (patch !== null) runWrite(() => store.update('pilot', pilot.id, patch, PLAY_TXN))
  }

  async function doHeatCheck() {
    let said: string | undefined
    const roll = await rollFor(overloadTableTitle, 'Heat Check', {
      plainD20s: 1,
      outcome: () => said,
    })
    const m = fresh()
    const mcap = mechMaxHeat(m, chassis)
    const { patch, effect, meltdown } = heatCheckOncePatch({
      heat: resolveGauge(m.currentHeat, mcap),
      currentSP: resolvePoolStart(m.currentSP, mechMaxSP(m, chassis)),
      roll,
      table: overloadTable,
    })
    const text = describeHeatCheck(effect, overloadTable)
    const { overloadRoll } = effect.result
    said = text
    runWrite(
      () => store.update('mech', mech.id, patch, PLAY_TXN),
      () => {
        setLog({ text, meltdown, ...(overloadRoll === undefined ? {} : { overloadRoll }) })
        hurtPilot(effect)
      }
    )
  }

  function doVent() {
    const before = resolveGauge(fresh().currentHeat, cap)
    runWrite(
      () => store.update('mech', mech.id, VENT_PATCH, PLAY_TXN),
      () => {
        setLog({
          text: playCopy('ventedHeat0VulnerableShut'),
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
        text: playCopy('noPushAtHeat2', { heat, cap, gain: pushHeat }),
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
        title={
          pushLocked
            ? playCopy('noPushAtHeat', { heat, cap })
            : playCopy('pushHeatThenTheHeatCheck', { gain: pushHeat })
        }
      >
        {playCopy('push')}
      </Toggle>
      <Button size="mini" onClick={doVent} disabled={off}>
        {playCopy('vent')}
      </Button>
      <Toggle size="mini" onClick={doShutdown} disabled={off} pressed={now.shutdown === true}>
        {now.shutdown === true ? playCopy('restart') : playCopy('shutDown')}
      </Toggle>
    </>
  )

  return (
    <li className="su-play-act" data-away={away || undefined} data-action-key="reactor">
      <Entity
        size="mini"
        context="play"
        model={MODEL}
        // The mech's own: an action wears its source unit's tone.
        tint="mech"
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
                      table={overloadTableTitle}
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
                        {playCopy('confirmMeltdownMarkMechDestroyed')}
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
