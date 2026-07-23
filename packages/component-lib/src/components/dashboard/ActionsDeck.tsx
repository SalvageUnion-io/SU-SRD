/**
 * ActionsDeck — the Actions instrument on the ONE light display surface. It lists
 * the active entity's activatable actions and opens a resolve panel for the
 * selected one (Activate / Roll / Push / Apply). Presentational: every rule +
 * store write lives in the ITUN wrapper, which computes this discriminated
 * view-model and wires the callbacks. This component only renders + calls back —
 * the reference card in the resolve panel is the reused ReferenceEntityCard.
 */

import { Badge } from '../chrome/Badge'
import { Button } from '../chrome/Button'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import type { ReferenceCardEntity } from '../referenceEntity/card/ReferenceEntityCard'

/**
 * A render-ready action row. The action ENTITY drives a shortform
 * `ReferenceEntityCard` badge (name · Cost · type · Damage · range) — the same
 * card the SRD renders — so the deck reuses the canonical action rendering
 * instead of a hand-rolled row. Reach/lock is resolved by the caller and
 * layered on top (dim + tooltip), never baked into the card.
 */
export type DeckRow = {
  key: string
  /** Any card-renderable entity — ACTIONS are meta-entities, not `SURefEntity`. */
  entity: ReferenceCardEntity
  /** Accessible name for the clickable badge (the action name). */
  name: string
  locked: boolean
  lockTitle?: string
}
export type DeckGroup = { label: string; rows: DeckRow[] }

export type ActionsDeckResolve = {
  onBack: () => void
  costLabel: string
  entity: ReferenceCardEntity
  /** EP-vs-AP cost radio for `activationCurrency === 'EP or AP'` actions. */
  currencyChoice?: {
    epCost: number
    currency: 'EP' | 'AP'
    pilotAvailable: boolean
    activated: boolean
    onCurrency: (c: 'EP' | 'AP') => void
  }
  /** `− X +` Hot(X) stepper + heat projection for variable-Heat actions. */
  variableHot?: {
    hotX: number
    activated: boolean
    projText: string
    over: boolean
    onDec: () => void
    onInc: () => void
  }
  controls: {
    activateLabel: string
    activateDisabled: boolean
    activateTitle?: string
    onActivate: () => void
    onRoll: () => void
    push?: { disabled: boolean; onPush: () => void }
    applyLabel: string
    applyDisabled: boolean
    onApply: () => void
    onClear: () => void
  }
  roll?: { roll: number; band: string; bandLabel: string; bandSummary: string } | null
  pushLog?: string | null
  applied: boolean
  applyRouted: boolean
}

export type ActionsDeckList = {
  tabs: readonly string[]
  activeTab: string
  onTab: (tab: string) => void
  groupingLabel: string
  groupingTitle: string
  onToggleGrouping: () => void
  rangeBands: readonly string[]
  activeRange: string
  onRange: (band: string) => void
  reachText: string
  sources: { label: string; stamp: string }[]
  sourceFilter: string | null
  onSourceFilter: (source: string | null) => void
  familyClass: string
  /** Host tone the action badges GHOST (mech vs pilot) — a resolvable CSS colour. */
  hostTone: string
  groups: DeckGroup[]
  onOpen: (key: string) => void
}

export type ActionsDeckView =
  | { kind: 'empty'; text: string }
  | ({ kind: 'list' } & ActionsDeckList)
  | ({ kind: 'resolve' } & ActionsDeckResolve)

export type ActionsDeckProps = { view: ActionsDeckView }

export function ActionsDeck({ view }: ActionsDeckProps) {
  if (view.kind === 'empty') {
    return (
      <div className="pc-display-scroll">
        <div className="pc-deck-empty">{view.text}</div>
      </div>
    )
  }

  if (view.kind === 'resolve') {
    const { currencyChoice, variableHot, controls, roll } = view
    return (
      <div className="pc-display-scroll">
        <div className="pc-deck-panel">
          <div className="pc-deck-panel-head">
            <Button variant="ghost" size="compact" onClick={view.onBack}>
              ◀ Back
            </Button>
            <span className="pc-deck-cost">{view.costLabel}</span>
          </div>

          <ReferenceEntityCard data={view.entity} />

          {currencyChoice && (
            <fieldset className="pc-deck-cost-choice">
              {/*
               * Deliberately NATIVE radios, not the chrome `Radio` primitive.
               * That primitive is a self-framed choice-row card
               * (`rounded-card border-chrome border-ink bg-paper p-2` around a
               * `font-body` label). Here the two options are compact inline
               * `pc-deck-radio` labels inside the already-bordered
               * `pc-deck-cost-choice` fieldset; the framed primitive would turn
               * the tight EP/AP pair into two bordered cards nested in a bordered
               * fieldset (foreign to this instrument). The `name` stays a real
               * radio-group form name. Adopt only once `Radio` grows a
               * bare/instrument rung (just the accent-rust input, no framed row).
               */}
              <legend className="pc-deck-cost-choice-lab">Pay with</legend>
              <label className="pc-deck-radio">
                <input
                  type="radio"
                  name="pc-deck-currency"
                  checked={currencyChoice.currency === 'EP'}
                  disabled={currencyChoice.activated}
                  onChange={() => currencyChoice.onCurrency('EP')}
                />
                {currencyChoice.epCost} EP
              </label>
              <label className="pc-deck-radio">
                <input
                  type="radio"
                  name="pc-deck-currency"
                  checked={currencyChoice.currency === 'AP'}
                  disabled={currencyChoice.activated || !currencyChoice.pilotAvailable}
                  onChange={() => currencyChoice.onCurrency('AP')}
                />
                {currencyChoice.epCost} AP
              </label>
            </fieldset>
          )}

          {variableHot && (
            <div className="pc-deck-hotx">
              <span className="pc-deck-hotx-lab">Hot</span>
              <div className="pc-step">
                <Button
                  size="compact"
                  className="min-w-0 px-2"
                  onClick={variableHot.onDec}
                  disabled={variableHot.activated}
                  aria-label="Decrease Hot"
                >
                  −
                </Button>
                <span className="pc-step-num">{variableHot.hotX}</span>
                <Button
                  size="compact"
                  className="min-w-0 px-2"
                  onClick={variableHot.onInc}
                  disabled={variableHot.activated}
                  aria-label="Increase Hot"
                >
                  +
                </Button>
              </div>
              <span className={`pc-deck-hotx-proj${variableHot.over ? ' is-over' : ''}`}>
                {variableHot.projText}
              </span>
            </div>
          )}

          <div className="pc-deck-controls">
            <Button
              size="compact"
              className="flex-1"
              onClick={controls.onActivate}
              disabled={controls.activateDisabled}
              title={controls.activateTitle}
            >
              {controls.activateLabel}
            </Button>
            <Button size="compact" className="flex-1" onClick={controls.onRoll}>
              Roll
            </Button>
            {controls.push && (
              <Button
                variant="danger"
                size="compact"
                className="flex-1"
                onClick={controls.push.onPush}
                disabled={controls.push.disabled}
                title="Reroll the d20, +2 Heat, forcing a Heat Check"
              >
                Push
              </Button>
            )}
            <Button
              size="compact"
              className="flex-1"
              onClick={controls.onApply}
              disabled={controls.applyDisabled}
              title="Commit this result"
            >
              {controls.applyLabel}
            </Button>
          </div>

          <div className="pc-deck-controls">
            <Button variant="ghost" size="compact" onClick={controls.onClear}>
              Clear
            </Button>
          </div>

          {roll && (
            <div className="pc-deck-roll" data-band={roll.band}>
              <span className="pc-deck-d20">{roll.roll}</span>
              <div className="pc-deck-band">
                <strong>{roll.bandLabel}</strong>
                <span>{roll.bandSummary}</span>
              </div>
            </div>
          )}
          {view.pushLog && <p className="pc-deck-pushlog">{view.pushLog}</p>}
          {view.applied && <p className="pc-deck-applied">Result applied ✓</p>}
          {view.applyRouted && (
            <p className="pc-deck-apply-route">
              Cascade Failure — a severe consequence. The Take-Damage control is open on the Active
              Item band above; confirm the hit there. Nothing was auto-applied.
            </p>
          )}
        </div>
      </div>
    )
  }

  // ---- List view ----
  return (
    <div className="pc-display-scroll">
      <div className="pc-deck-controls-bar">
        <div className="pc-deck-tabs" role="tablist" aria-label="Filter actions by timing">
          {view.tabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={view.activeTab === t}
              className={`pc-deck-tab${view.activeTab === t ? ' is-active' : ''}`}
              onClick={() => view.onTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="pc-deck-toolrow">
          <button
            type="button"
            className="pc-deck-tool"
            onClick={view.onToggleGrouping}
            title={view.groupingTitle}
          >
            Group: {view.groupingLabel}
          </button>
          <div className="pc-deck-range">
            {view.rangeBands.map((band) => (
              <button
                key={band}
                type="button"
                aria-pressed={view.activeRange === band}
                className={`pc-deck-range-btn${view.activeRange === band ? ' is-active' : ''}`}
                onClick={() => view.onRange(band)}
                title={`Set engagement range to ${band}`}
              >
                {band[0]}
              </button>
            ))}
            <span className="pc-deck-reach">{view.reachText}</span>
          </div>
        </div>

        {view.sources.length > 1 && (
          <div className={`pc-deck-sources ${view.familyClass}`}>
            <button
              type="button"
              aria-pressed={view.sourceFilter === null}
              className={`pc-deck-source${view.sourceFilter === null ? ' is-active' : ''}`}
              onClick={() => view.onSourceFilter(null)}
            >
              All
            </button>
            {view.sources.map((src) => (
              <button
                key={`${src.stamp}:${src.label}`}
                type="button"
                aria-pressed={view.sourceFilter === src.label}
                className={`pc-deck-source${view.sourceFilter === src.label ? ' is-active' : ''}`}
                onClick={() =>
                  view.onSourceFilter(view.sourceFilter === src.label ? null : src.label)
                }
                title={`Filter the deck to “${src.label}” actions.`}
              >
                <Badge shape="stamp" size="mini" className="rounded-card px-1 py-px text-label">
                  {src.stamp}
                </Badge>
                {src.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {view.groups.length === 0 ? (
        <div className="pc-deck-empty">No actions match this filter.</div>
      ) : (
        <div className="pc-deck">
          {view.groups.map((group) => (
            <section key={group.label}>
              <h3 className="pc-deck-group-lab">{group.label}</h3>
              <ul className="pc-deck-list">
                {group.rows.map((row) => (
                  // Lock (out of range / overheat) is a caller-resolved overlay,
                  // layered on the canonical badge — dim + tooltip — never a
                  // property of the action card itself.
                  <li
                    key={row.key}
                    className={row.locked ? 'is-locked' : undefined}
                    title={row.lockTitle}
                  >
                    <ReferenceEntityCard
                      data={row.entity}
                      size="small"
                      extent="head"
                      hostTone={view.hostTone}
                      disabled={row.locked}
                      cardClickLabel={row.name}
                      onCardClick={() => view.onOpen(row.key)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
