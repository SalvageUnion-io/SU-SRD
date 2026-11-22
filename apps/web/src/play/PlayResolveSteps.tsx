/**
 * PlayResolveSteps — an action's resolve, opened in place as its Mini's
 * contentful body (play.md §5): Activate, then the Core Mechanic table, then
 * Apply. Roll pays the cost where Activate has not, and a line says what it
 * will spend (r4 A1); an action with no cost has no Activate (r4 A2).
 * After a roll the keyboard is on Apply (r4 A3), and the rolled row is clear
 * of the sticky Apply bar (r4 A4).
 * Presentational:
 * `useActionsDeck` builds the `ResolveModel` from the seat's `resolving` and
 * owns every write; this draws its steps and calls back.
 *
 * The roll is the table's (`PlayRollInstrument`, R8): its ROLL THE DIE stamp
 * is the one roll control, and the result is its marked row. Once a mech's
 * action has rolled, the same stamp reads Push (reroll, +2 Heat and a Heat
 * Check, Core Book p.233) while a Push is open to it.
 *
 * Inside a Mini, which nests nothing (E6), so the steps are plain buttons and
 * plain content (the Nested Frames Audit, play.md §12): no box, card, entity
 * or titled head of their own.
 * A note (the Cascade Failure hand-off) is an unlabelled Callout.
 *
 * An Area Salvage reads its own table (Core Book p.248): the area it spends
 * Supply from is a line above the roll, the roll is refused while there is
 * none or it is picked clean, and once applied a line says what was carried.
 * A solo screen names the area here (`SalvageAreaDialog`); in a Game the
 * Mediator does.
 */

import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { AREA_SALVAGE_TABLE } from 'salvageunion-reference/rules'
import { Button, Callout, tokens } from '../components/index'
import { playCopy } from '../messages/play'
import type { ResolveModel } from './actionsDeck.model'
import { clearOfBar } from './clearOfBar.model'
import { ResolveCost, ResolveSpend } from './PlayResolveCost'
import { PlayRollInstrument } from './PlayRollInstrument'
import { SalvageAreaDialog } from './SalvageAreaDialog'
import { CORE_MECHANIC_TABLE } from './tables.model'

type Resolving = Extract<ResolveModel, { kind: 'resolve' }>

const AREA = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
} satisfies CSSProperties

const GROW = { flex: '1 1 0', minWidth: 0 } satisfies CSSProperties

const NOTE = {
  margin: 0,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  color: tokens.color.ink,
} satisfies CSSProperties

export function PlayResolveSteps({ view, canWrite }: { view: Resolving; canWrite: boolean }) {
  const { controls, roll, salvage } = view
  // Rolled, a mech's action Pushes from the same stamp while it may.
  const push = roll && controls.push && !controls.push.disabled ? controls.push : null
  const [settingArea, setSettingArea] = useState(false)
  // After a roll the keyboard is on Apply, never left on the stamp, which now
  // reads Push: a second Enter there would reroll and add Heat (r4 A3).
  const applyRef = useRef<HTMLButtonElement>(null)
  const rolling = useRef(false)
  const rolls = (run: () => void) => () => {
    rolling.current = true
    run()
  }
  const hostRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!rolling.current || !canWrite || controls.applyDisabled) return
    rolling.current = false
    // The bar is on screen already: the focus never moves the pane.
    applyRef.current?.focus({ preventScroll: true })
    clearOfBar(hostRef.current)
  })
  // An Area Salvage rolls only while its area has Supply to spend.
  // Why Area Salvage has nothing to roll on: said in its note, and on the roll, which stands off.
  const salvageShut =
    salvage === undefined
      ? undefined
      : salvage.area === null
        ? playCopy(salvage.onSetArea ? 'salvageNoAreaSolo' : 'salvageNoArea')
        : salvage.area.supply <= 0
          ? playCopy('salvagePickedClean')
          : undefined
  const salvageOpen = salvageShut === undefined
  return (
    <div ref={hostRef} className="su-play-resolve">
      {/* Mounted before the first roll, so the d20, its band and Apply are
          spoken as they land; each line is one text node, read whole. */}
      <div aria-live="polite" className="su-sr-only">
        {roll && (
          <p>
            {playCopy('rolled', {
              roll: roll.roll,
              bandLabel: roll.bandLabel,
              bandSummary: roll.bandSummary,
            })}
          </p>
        )}
        {salvage?.rolled && salvage.roll !== null && (
          <p>
            {playCopy('rolled', {
              roll: salvage.roll,
              bandLabel: salvage.rolled.label,
              bandSummary: salvage.rolled.text,
            })}
          </p>
        )}
        {view.pushLog && <p>{view.pushLog}</p>}
        {view.applied && <p>{playCopy('resultApplied')}</p>}
      </div>

      <div className="su-play-resolve__spend">
        <ResolveSpend cost={view.cost} currency={view.currency} />
      </div>
      <ResolveCost currencyChoice={view.currencyChoice} variableHot={view.variableHot} />

      {/* An action with no cost has nothing to activate: Roll alone (r4 A2). */}
      {!view.free && (
        <div className="su-play-resolve__steps">
          <Button
            variant={controls.activated ? 'default' : 'primary'}
            size="compact"
            style={GROW}
            onClick={controls.onActivate}
            disabled={!canWrite || controls.activateDisabled}
            title={controls.activateTitle}
          >
            {controls.activated ? playCopy('activated') : playCopy('activate')}
          </Button>
        </div>
      )}
      {/* Roll pays what Activate has not (r4 A1): said before it is pressed. */}
      {view.rollSpends && !controls.rollLockedReason && <p style={NOTE}>{view.rollSpends}</p>}
      {controls.rollLockedReason && <p style={NOTE}>{controls.rollLockedReason}</p>}

      {salvage && (
        <div style={AREA}>
          <p style={NOTE}>
            {salvageShut ??
              (salvage.area === null
                ? ''
                : playCopy('salvageArea', {
                    name: salvage.area.name === '' ? '' : `${salvage.area.name} · `,
                    tl: salvage.area.techLevel,
                    supply: salvage.area.supply,
                  }))}
          </p>
          {salvage.onSetArea && (
            <Button
              variant="ghost"
              size="mini"
              disabled={!canWrite}
              onClick={() => setSettingArea(true)}
            >
              {playCopy(salvage.area === null ? 'setTheArea' : 'changeTheArea')}
            </Button>
          )}
        </div>
      )}

      <PlayRollInstrument
        table={salvage ? AREA_SALVAGE_TABLE : CORE_MECHANIC_TABLE}
        roll={salvage ? salvage.roll : (roll?.roll ?? null)}
        stamp={push ? 'Push:' : undefined}
        onRoll={
          canWrite && salvageOpen && !controls.rollLockedReason
            ? rolls(push ? push.onPush : controls.onRoll)
            : undefined
        }
        off={salvageShut}
      />
      {controls.push?.lockedReason && <p style={NOTE}>{controls.push.lockedReason}</p>}

      {/* The ways forward stay on screen under the table, however long it is (r2 I3). */}
      <div className="su-play-resolve__steps su-play-resolve__forward">
        <Button
          ref={applyRef}
          size="compact"
          style={GROW}
          onClick={controls.onApply}
          disabled={!canWrite || controls.applyDisabled}
          title={playCopy('commitThisResult')}
        >
          {controls.applyLabel}
        </Button>
        <Button
          variant="ghost"
          size="compact"
          onClick={() => {
            rolling.current = false
            controls.onClear()
          }}
          disabled={!canWrite}
        >
          {playCopy('startOver')}
        </Button>
      </div>
      {!view.applied && <p style={NOTE}>{playCopy('resolveStepsHint')}</p>}

      {view.pushLog && <p style={NOTE}>{view.pushLog}</p>}
      {view.meltdown && (
        <Button variant="primary" size="compact" onClick={view.meltdown.onConfirm}>
          {playCopy('confirmMeltdownMarkMechDestroyed')}
        </Button>
      )}
      {view.applied && <p style={NOTE}>{playCopy('resultApplied2')}</p>}
      {salvage?.onSetArea && (
        <SalvageAreaDialog
          key={settingArea ? 'open' : 'closed'}
          open={settingArea}
          area={salvage.area}
          onClose={() => setSettingArea(false)}
          onSave={salvage.onSetArea}
        />
      )}
      {view.applyRouted && <Callout>{playCopy('cascadeFailureASevereConsequence')}</Callout>}
    </div>
  )
}
