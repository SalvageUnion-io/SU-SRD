/**
 * PhoneResolve — resolving an action on a phone (ADR-043 D7, board D5). It
 * replaces the bar, the tabs and the tab body: a view swap inside the
 * Dashboard, not a route and not a modal.
 *
 *  - **Header:** ‹ back, "Resolving", and the pinned vitals (Heat while
 *    boarded, plus the action's currency).
 *  - **Body** (paper, the one "forward" surface, ADR-038 §8): the action card
 *    at full extent, whose pennant is Activate; ROLL THE DIE and the rolled
 *    row, with the whole table one tap away; the Push and Heat Check line.
 *  - **Bottom bar:** only the next step of the `ResolveModel` the canvas's
 *    Resolve tab renders — Activate, then Roll, then Push (mech actions, once
 *    a roll, never past the Heat Cap: Core Book p.233) and Apply, then Done.
 *
 * Back leaves the resolve on the seat, where the crew sees it; the Major's tab
 * then offers to resume it. A meltdown and a Cascade Failure are confirmed in
 * a `ConfirmDialog` before anything follows from them (ADR-007).
 *
 * Presentational: `useActionsDeck` owns every write.
 */

import { Badge, Button, ConfirmDialog, ReferenceEntityCard } from 'component-lib'
import {
  borderWidth,
  color,
  font,
  fontSize,
  space,
  tracking,
  weight,
} from 'component-lib/design/tokens'
import { ChevronLeft } from 'lucide-react'
import type { CSSProperties, RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import type { PinnedVital } from './PinnedVitals'
import { PinnedVitals } from './PinnedVitals'
import type { ResolveModel } from './ResolvePanel'
import { ResolveCost } from './ResolvePanel'

const SCREEN: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100dvh',
  background: color.paper,
}

const HEAD: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  display: 'flex',
  alignItems: 'center',
  gap: space[8],
  padding: `${space[4]} ${space[12]} ${space[4]} ${space[4]}`,
  background: color.bandCream,
  borderBottom: `${borderWidth.chrome} solid ${color.ink20}`,
}

const TITLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  margin: 0,
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.readout,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
  outline: 'none',
}

const ICON: CSSProperties = { minWidth: '44px', minHeight: '44px' }

/** A fieldset that draws nothing: it only carries `disabled` when read-only. */
const PLAIN: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 0,
  border: 0,
  margin: 0,
  padding: 0,
}

const BODY: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
  flex: 1,
  padding: space[16],
}

const ROLL: CSSProperties = { display: 'flex', alignItems: 'center', gap: space[12] }

const ROLL_STAMP: CSSProperties = { fontSize: fontSize.caption }

const DIE: CSSProperties = {
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.hero,
  lineHeight: 1,
  fontVariantNumeric: 'tabular-nums',
}

const BAND: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[4],
  padding: space[12],
  border: `${borderWidth.entity} solid ${color.ink}`,
}

const BAND_LABEL: CSSProperties = {
  margin: 0,
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.readout,
}

const TEXT: CSSProperties = {
  margin: 0,
  fontFamily: font.body,
  fontSize: fontSize.caption,
  lineHeight: 1.45,
  color: color.ink,
}

const BAR: CSSProperties = {
  position: 'sticky',
  bottom: 0,
  zIndex: 2,
  display: 'grid',
  gridAutoColumns: 'minmax(0, 1fr)',
  gridAutoFlow: 'column',
  gap: space[8],
  minInlineSize: 0,
  margin: 0,
  padding: space[12],
  background: color.bandCream,
  border: 0,
  borderTop: `${borderWidth.chrome} solid ${color.ink20}`,
}

const STEP: CSSProperties = { width: '100%', minHeight: '48px' }

/** Where focus goes when the screen opens: its heading. */
function useFocusOnMount(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    ref.current?.focus()
  }, [ref])
}

type Resolving = Extract<ResolveModel, { kind: 'resolve' }>

/** The bottom bar: the resolve's next step, and nothing else. */
function NextStep({
  view,
  onApply,
  onTakeHit,
}: {
  view: Resolving
  onApply: () => void
  onTakeHit: () => void
}) {
  const { controls, roll } = view
  if (view.applied) {
    return (
      <Button variant="primary" size="full" style={STEP} onClick={view.onBack}>
        Done
      </Button>
    )
  }
  if (view.applyRouted) {
    return (
      <Button variant="primary" size="full" style={STEP} onClick={onTakeHit}>
        Take the hit ›
      </Button>
    )
  }
  if (!roll) {
    if (!controls.activated) {
      return (
        <Button
          variant="primary"
          size="full"
          style={STEP}
          onClick={controls.onActivate}
          disabled={controls.activateDisabled}
          title={controls.activateTitle}
        >
          {view.costLabel === 'No cost' ? 'Activate' : `Activate · ${view.costLabel}`}
        </Button>
      )
    }
    return (
      <Button variant="primary" size="full" style={STEP} onClick={controls.onRoll}>
        Roll the die
      </Button>
    )
  }
  const push = controls.push
  return (
    <>
      {push && !push.pushed && (
        <Button
          size="full"
          style={STEP}
          onClick={push.onPush}
          disabled={push.disabled}
          title="Re-roll the d20: +2 Heat, then a Heat Check"
        >
          Push · Re-roll +2 Heat
        </Button>
      )}
      <Button
        variant="primary"
        size="full"
        style={STEP}
        onClick={onApply}
        disabled={controls.applyDisabled}
      >
        {`Apply · ${roll.bandLabel}`}
      </Button>
    </>
  )
}

export function PhoneResolve({
  view,
  vitals,
  readOnly,
  onBack,
  onTakeHit,
}: {
  view: ResolveModel
  /** Heat while boarded, plus the action's currency (D8). */
  vitals: PinnedVital[]
  /** Why nothing here can be pressed (Disconnected, Outdated), or null. */
  readOnly: string | null
  /** ‹: back to the tab, leaving the resolve on the seat. */
  onBack: () => void
  /** A Cascade Failure was handed to the Major: go to its Take Damage. */
  onTakeHit: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useFocusOnMount(heading)
  const [fullTable, setFullTable] = useState(false)
  const [confirmCascade, setConfirmCascade] = useState(false)
  const meltdown = view.kind === 'resolve' ? (view.meltdown ?? null) : null
  // Escape is Back, unless a confirm is up: that Escape is the confirm's.
  useEscapeKey(!confirmCascade && meltdown === null, onBack)

  const resolving = view.kind === 'resolve' ? view : null
  const apply = () => {
    if (!resolving?.roll) return
    if (resolving.roll.destructive) {
      setConfirmCascade(true)
      return
    }
    resolving.controls.onApply()
  }

  return (
    <section aria-labelledby="dash-phone-resolving" style={SCREEN}>
      <div style={HEAD}>
        <Button
          variant="ghost"
          size="iconOnly"
          style={ICON}
          onClick={onBack}
          aria-label="Back to the Dashboard"
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </Button>
        <h2 id="dash-phone-resolving" ref={heading} tabIndex={-1} style={TITLE}>
          Resolving
        </h2>
        <PinnedVitals vitals={vitals} label="Pinned vitals" />
      </div>
      <fieldset disabled={readOnly !== null} style={PLAIN}>
        <legend style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
          {resolving ? `Resolving ${resolving.entity.name}` : 'Resolving'}
        </legend>
        <div style={BODY}>
          {readOnly && <p style={TEXT}>{readOnly}</p>}
          {resolving === null ? (
            <>
              <p style={TEXT}>{view.kind === 'idle' ? view.text : ''}</p>
              {view.kind === 'idle' && view.onClear ? (
                <Button variant="default" size="full" style={STEP} onClick={view.onClear}>
                  Clear
                </Button>
              ) : null}
            </>
          ) : (
            <>
              {/* The pennant IS Activate, as on the canvas (ruleset §1). */}
              <ReferenceEntityCard
                data={resolving.entity}
                texture={false}
                hide={fullTable ? undefined : { rollTable: true }}
                controls={[
                  {
                    key: 'activate',
                    pennant: true,
                    label: resolving.controls.activateLabel,
                    onClick: resolving.controls.onActivate,
                    disabled: resolving.controls.activateDisabled,
                    title: resolving.controls.activateTitle,
                  },
                ]}
              />
              <ResolveCost
                currencyChoice={resolving.currencyChoice}
                variableHot={resolving.variableHot}
              />
              {resolving.roll && (
                <>
                  <div style={ROLL}>
                    <Badge shape="stamp" style={ROLL_STAMP}>
                      Roll the die:
                    </Badge>
                    <span style={DIE}>{resolving.roll.roll}</span>
                  </div>
                  <div style={BAND} data-band={resolving.roll.band}>
                    <p style={BAND_LABEL}>
                      {resolving.roll.bandRange} · {resolving.roll.bandLabel}
                    </p>
                    <p style={TEXT}>{resolving.roll.bandSummary}</p>
                  </div>
                </>
              )}
              <Button
                variant="ghost"
                size="full"
                style={STEP}
                aria-expanded={fullTable}
                onClick={() => setFullTable((open) => !open)}
              >
                {fullTable ? 'Hide the full table' : 'Full table'}
              </Button>
              <div aria-live="polite">
                {resolving.pushLog && <p style={TEXT}>{resolving.pushLog}</p>}
              </div>
              {resolving.controls.activateDisabled &&
                !resolving.controls.activated &&
                resolving.controls.activateTitle && (
                  <p style={TEXT}>{resolving.controls.activateTitle}</p>
                )}
              {resolving.applyRouted && (
                <p style={TEXT}>
                  Cascade Failure: Take Damage is open on your Major. Nothing was written; set the
                  hit there.
                </p>
              )}
            </>
          )}
        </div>
        {resolving && (
          <fieldset aria-label="Next step" style={BAR}>
            <NextStep view={resolving} onApply={apply} onTakeHit={onTakeHit} />
          </fieldset>
        )}
      </fieldset>
      {resolving && (
        <ConfirmDialog
          open={confirmCascade}
          onOpenChange={setConfirmCascade}
          title="Cascade Failure"
          tone="danger"
          body="A severe consequence. Take Damage opens on your Major for you to set and apply the hit; nothing is written until you do."
          confirmLabel="Take the hit"
          onConfirm={() => {
            setConfirmCascade(false)
            resolving.controls.onApply()
            onTakeHit()
          }}
        />
      )}
      {meltdown && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) meltdown.onDismiss()
          }}
          title="Reactor meltdown"
          tone="danger"
          body={`${resolving?.pushLog ?? 'The Heat Check melted the reactor down.'} Mark the mech Destroyed?`}
          confirmLabel="Mark Destroyed"
          onConfirm={meltdown.onConfirm}
        />
      )}
    </section>
  )
}
