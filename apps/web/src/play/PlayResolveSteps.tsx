/**
 * PlayResolveSteps — an action's resolve, opened in place as its Mini's
 * contentful body (play.md §5): Activate, then the Core Mechanic table, then
 * Apply. Presentational:
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
import { useState } from 'react'
import { AREA_SALVAGE_TABLE } from 'salvageunion-reference/rules'
import { Button, Callout, tokens } from '../components/index'
import { playCopy } from '../messages/play'
import { ResolveCost, ResolveSpend } from './PlayResolveCost'
import { PlayRollInstrument } from './PlayRollInstrument'
import { SalvageAreaDialog } from './SalvageAreaDialog'
import type { ResolveModel } from './useActionsDeck'

type Resolving = Extract<ResolveModel, { kind: 'resolve' }>

/** The table every action's roll reads (Core Book p.233), but Area Salvage's own. */
const CORE_MECHANIC = 'Core Mechanic'

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
  // An Area Salvage rolls only while its area has Supply to spend.
  const salvageOpen = salvage === undefined || (salvage.area !== null && salvage.area.supply > 0)
  return (
    <div className="su-play-resolve">
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
        {salvage?.haul && <p>{salvage.haul}</p>}
        {view.pushLog && <p>{view.pushLog}</p>}
        {view.applied && <p>{playCopy('resultApplied')}</p>}
      </div>

      <div className="su-play-resolve__spend">
        <ResolveSpend cost={view.cost} currency={view.currency} />
      </div>
      <ResolveCost currencyChoice={view.currencyChoice} variableHot={view.variableHot} />

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

      {salvage && (
        <div style={AREA}>
          <p style={NOTE}>
            {salvage.area === null
              ? playCopy(salvage.onSetArea ? 'salvageNoAreaSolo' : 'salvageNoArea')
              : salvage.area.supply <= 0
                ? playCopy('salvagePickedClean')
                : playCopy('salvageArea', {
                    name: salvage.area.name === '' ? '' : `${salvage.area.name} · `,
                    tl: salvage.area.techLevel,
                    supply: salvage.area.supply,
                  })}
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
        table={salvage ? AREA_SALVAGE_TABLE : CORE_MECHANIC}
        roll={salvage ? salvage.roll : (roll?.roll ?? null)}
        stamp={push ? 'Push:' : undefined}
        onRoll={canWrite && salvageOpen ? (push ? push.onPush : controls.onRoll) : undefined}
      />
      {controls.push?.lockedReason && <p style={NOTE}>{controls.push.lockedReason}</p>}

      <div className="su-play-resolve__steps">
        <Button
          size="compact"
          style={GROW}
          onClick={controls.onApply}
          disabled={!canWrite || controls.applyDisabled}
          title={playCopy('commitThisResult')}
        >
          {controls.applyLabel}
        </Button>
        <Button variant="ghost" size="compact" onClick={controls.onClear} disabled={!canWrite}>
          {playCopy('clear')}
        </Button>
      </div>

      {view.pushLog && <p style={NOTE}>{view.pushLog}</p>}
      {view.meltdown && (
        <Button variant="primary" size="compact" onClick={view.meltdown.onConfirm}>
          {playCopy('confirmMeltdownMarkMechDestroyed')}
        </Button>
      )}
      {view.applied && <p style={NOTE}>{playCopy('resultApplied2')}</p>}
      {salvage?.haul && <p style={NOTE}>{salvage.haul}</p>}
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
