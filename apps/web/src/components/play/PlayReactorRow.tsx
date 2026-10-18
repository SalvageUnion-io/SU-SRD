/**
 * PlayReactorRow — the mech's Reactor as a row of the Actions list (play.md
 * §5): Push, Heat Check, Vent and Shut down, writing the reactor's patches
 * (`lib/rules/playActions`).
 *
 * ADR-007: Push, Heat Check, Vent and Shut down are bookkeeping and apply on
 * one press; a Meltdown's destruction is the player's, behind its own button.
 * A Push that would pass the Heat Capacity is refused and says why (Core Book
 * p.234). Every Heat Check's dice go on Play's roll log with what they came to
 * (`rollFor`, `playRolls.model.ts`: the Feed, the Game's log, Discord); a Vent
 * or a Shut down is an applied change on the Feed (`recordPlayChange`).
 *
 * Level 1 in the column, a titled row with no body until there is something
 * to read: the result is plain content under its head (play.md §12).
 */

import type { Mech } from 'cantina-domain/schemas/mech'
import { useState } from 'react'
import {
  canPush,
  mechMaxHeat,
  mechMaxSP,
  resolveChassisRef,
  resolveGauge,
  resolvePoolStart,
} from 'salvageunion-reference/rules'
import {
  describeHeatCheck,
  heatCheckOncePatch,
  mechPush,
  shutdownTogglePatch,
  VENT_PATCH,
} from '../../lib/rules/playActions'
import { runWrite } from '../../lib/runWrite'
import { PLAY_TXN } from '../../stores/surfaceProvenance'
import { Button, TitledBox } from '../index'
import type { PlayStore } from './play.model'
import { recordPlayChange } from './playRolls.model'
import type { PlayActions } from './usePlayActions'

type ReactorLog = { text: string; meltdown: boolean }

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
  const fresh = () => store.get('mech', mech.id) ?? mech
  const chassis = resolveChassisRef(mech.chassisRef)
  const now = fresh()
  const cap = mechMaxHeat(now, chassis)
  const heat = resolveGauge(now.currentHeat, cap)
  const pushLocked = !canPush(heat, cap)
  const away = need !== null
  const off = !canWrite || away

  async function doPush() {
    // What the Push came to, read by the roll log once the dice are.
    let said: string | undefined
    const roll = await rollFor('Reactor Overload', 'Push', {
      plainD20s: 1,
      outcome: () => said,
    })
    const pushed = mechPush(fresh(), roll)
    if (pushed === null) return
    const { patch, text, meltdown } = pushed
    said = text
    runWrite(
      () => store.update('mech', mech.id, patch, PLAY_TXN),
      () => setLog({ text, meltdown })
    )
  }

  async function doHeatCheck() {
    let said: string | undefined
    const roll = await rollFor('Reactor Overload', 'Heat Check', {
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
    said = text
    runWrite(
      () => store.update('mech', mech.id, patch, PLAY_TXN),
      () => setLog({ text, meltdown })
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

  const controls = away ? (
    <span className="su-play-act__need">{need}</span>
  ) : (
    <span className="su-play-act__buttons">
      <Button
        size="mini"
        onClick={() => {
          if (pushLocked) {
            setLog({
              text: `No Push at Heat ${heat}/${cap}: +2 Heat would pass the Heat Capacity. Vent or take a Heat Check first.`,
              meltdown: false,
            })
            return
          }
          void doPush()
        }}
        disabled={off}
        title={pushLocked ? `No Push at Heat ${heat}/${cap}` : '+2 Heat, then a Heat Check'}
      >
        Push
      </Button>
      <Button size="mini" onClick={() => void doHeatCheck()} disabled={off}>
        Heat Check
      </Button>
      <Button size="mini" onClick={doVent} disabled={off}>
        Vent
      </Button>
      <Button size="mini" onClick={doShutdown} disabled={off} aria-pressed={now.shutdown === true}>
        {now.shutdown === true ? 'Restart' : 'Shut down'}
      </Button>
    </span>
  )

  return (
    <li className="su-play-act" data-away={away || undefined} data-action-key="reactor">
      <TitledBox title="Reactor" controls={controls} as="div">
        {log && !away ? (
          <div className="su-play-resolve">
            <p className="su-play-resolve__note" aria-live="polite">
              {log.text}
            </p>
            {log.meltdown && (
              <Button variant="danger" size="compact" onClick={confirmMeltdown}>
                Confirm Meltdown — Mark Mech destroyed
              </Button>
            )}
          </div>
        ) : null}
      </TitledBox>
    </li>
  )
}
