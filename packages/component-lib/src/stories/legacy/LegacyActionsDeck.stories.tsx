/**
 * Legacy "before" capture — ITUN Dashboard `ActionsDeck` (light display surface,
 * Phase 5 / workstream D1–D2).
 *
 * Reproduces the deck's presentational shell from
 * apps/in-the-union-now/src/components/dashboard/ActionsDeck.tsx VERBATIM — the
 * `.pc-deck*` list view (timing tabs, grouping toggle, range selector + reach
 * readout, source tags, grouped action items) and the `.pc-deck-panel` resolve
 * view (Back/cost head, the reused ReferenceEntityDisplay, pay-with radios, the
 * Hot(X) `.pc-step` stepper, Activate/Roll/Push/Apply controls, the d20 roll
 * readout). The store/rules plumbing (`dashboardRules`, entityStore, playState)
 * is collapsed to local fixtures built from real `SalvageUnionReference.Actions`
 * so the shell is self-contained. L1 reconciliation: freeze the "before", do not
 * refactor the raw markup.
 */

import type { Story } from '@ladle/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from '../../components/referenceEntity/card/referenceEntityDisplayShim'
import { Caption } from '../_harness'
import './LegacyActionsDeck.css'

// --- Local mirrors of ActionsDeck's app-only shapes (cannot import from apps) ---
type DeckStamp = 'CHS' | 'SYS' | 'MOD' | 'ABL' | 'EQP'
type DeckCurrency = 'EP' | 'AP'
type DeckItem = {
  key: string
  name: string
  stamp: DeckStamp
  currency: DeckCurrency
  epCost: number
  meta: string[]
  locked: boolean
  action: SURefEntity
}
type DeckGroup = { label: string; items: DeckItem[] }

// The real deck constants (from dashboardRules.ts, mirrored locally).
const TIMING_TABS = ['All', 'Turn', 'Short', 'Long', 'Free', 'React'] as const
const RANGE_BANDS = ['Close', 'Medium', 'Long', 'Far'] as const
type TimingTab = (typeof TIMING_TABS)[number]
type RangeBand = (typeof RANGE_BANDS)[number]

/** Build two real source groups from the reference Actions dataset. */
function buildGroups(): DeckGroup[] {
  const actions = SalvageUnionReference.Actions.all()
  const take = (start: number): DeckItem[] =>
    actions.slice(start, start + 4).map((a, i) => {
      const raw = a as unknown as {
        name: string
        actionType?: string
        range?: string
        activationCost?: number
      }
      const meta: string[] = []
      if (raw.actionType) meta.push(String(raw.actionType))
      if (raw.range) meta.push(String(raw.range))
      return {
        key: `${start}:${i}:${raw.name}`,
        name: raw.name,
        stamp: (start === 0 ? 'SYS' : 'MOD') as DeckStamp,
        currency: 'EP' as DeckCurrency,
        epCost: typeof raw.activationCost === 'number' ? raw.activationCost : 0,
        meta,
        locked: i === 3, // one out-of-range/heat-locked card, dimmed in place
        action: a as unknown as SURefEntity,
      }
    })
  const first = actions[0]?.name ?? 'Chassis'
  const second = actions[4]?.name ?? 'System'
  return [
    { label: first, items: take(0) },
    { label: second, items: take(4) },
  ]
}

/** Verbatim reproduction of ActionsDeck's LIST view (lines ~400–524). */
function DeckList({ groups, onOpen }: { groups: DeckGroup[]; onOpen: (item: DeckItem) => void }) {
  const [tab, setTab] = useState<TimingTab>('All')
  const [grouping, setGrouping] = useState<'source' | 'timing'>('source')
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)
  const [range, setRange] = useState<RangeBand>('Close')

  const sources = groups.map((g) => ({ label: g.label, stamp: g.items[0]?.stamp ?? 'SYS' }))
  const total = groups.reduce((n, g) => n + g.items.length, 0)
  const inReach = groups.reduce((n, g) => n + g.items.filter((i) => !i.locked).length, 0)

  return (
    <div className="pc-display-scroll">
      <div className="pc-deck-controls-bar">
        <div className="pc-deck-tabs" role="tablist" aria-label="Filter actions by timing">
          {TIMING_TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`pc-deck-tab${tab === t ? ' is-active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="pc-deck-toolrow">
          <button
            type="button"
            className="pc-deck-tool"
            onClick={() => setGrouping((g) => (g === 'source' ? 'timing' : 'source'))}
            title={grouping === 'source' ? 'Group by timing' : 'Group by source'}
          >
            Group: {grouping === 'source' ? 'Source' : 'Timing'}
          </button>
          <div className="pc-deck-range">
            {RANGE_BANDS.map((band) => (
              <button
                key={band}
                type="button"
                aria-pressed={range === band}
                className={`pc-deck-range-btn${range === band ? ' is-active' : ''}`}
                onClick={() => setRange(band)}
                title={`Set engagement range to ${band}`}
              >
                {band[0]}
              </button>
            ))}
            <span className="pc-deck-reach">
              {inReach} / {total} in reach
            </span>
          </div>
        </div>

        {sources.length > 1 && (
          <div className="pc-deck-sources pc-deck-fam-mech">
            <button
              type="button"
              aria-pressed={sourceFilter === null}
              className={`pc-deck-source${sourceFilter === null ? ' is-active' : ''}`}
              onClick={() => setSourceFilter(null)}
            >
              All
            </button>
            {sources.map((src) => (
              <button
                key={`${src.stamp}:${src.label}`}
                type="button"
                aria-pressed={sourceFilter === src.label}
                className={`pc-deck-source${sourceFilter === src.label ? ' is-active' : ''}`}
                onClick={() => setSourceFilter((cur) => (cur === src.label ? null : src.label))}
                title={`Filter the deck to “${src.label}” actions.`}
              >
                <span className="pc-deck-stamp">{src.stamp}</span>
                {src.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pc-deck">
        {groups
          .filter((g) => sourceFilter === null || g.label === sourceFilter)
          .map((group) => (
            <section key={group.label} className="pc-deck-group">
              <h3 className="pc-deck-group-lab">{group.label}</h3>
              <ul className="pc-deck-list">
                {group.items.map((action) => (
                  <li key={action.key}>
                    <button
                      type="button"
                      className={`pc-deck-item${action.locked ? ' is-locked' : ''}`}
                      onClick={() => onOpen(action)}
                      title={action.locked ? 'Out of range / overheat' : undefined}
                    >
                      <span className="pc-deck-item-main">
                        <span className="pc-deck-stamp">{action.stamp}</span>
                        <span className="pc-deck-item-name">{action.name}</span>
                        {action.meta.length > 0 && (
                          <span className="pc-deck-item-meta">{action.meta.join(' · ')}</span>
                        )}
                      </span>
                      {action.epCost > 0 && (
                        <span className="pc-deck-item-cost">
                          {action.epCost} {action.currency}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </div>
  )
}

/** Verbatim reproduction of ActionsDeck's RESOLVE panel (lines ~247–382). */
function DeckPanel({ item, onBack }: { item: DeckItem; onBack: () => void }) {
  const [activated, setActivated] = useState(false)
  const [currency, setCurrency] = useState<DeckCurrency>('EP')
  const [hotX, setHotX] = useState(1)
  const [rolled, setRolled] = useState(false)
  const [applied, setApplied] = useState(false)

  const heatCap = 6
  const projectedHeat = 2 + hotX
  const heatOk = projectedHeat <= heatCap
  const cost = [`${item.epCost} ${currency}`, `+${hotX} Heat`].join(' · ')

  return (
    <div className="pc-display-scroll">
      <div className="pc-deck-panel">
        <div className="pc-deck-panel-head">
          <button type="button" className="pc-deck-back" onClick={onBack}>
            ◀ Back
          </button>
          <span className="pc-deck-cost">{cost}</span>
        </div>

        <ReferenceEntityDisplay data={item.action} />

        <fieldset className="pc-deck-cost-choice">
          <legend className="pc-deck-cost-choice-lab">Pay with</legend>
          <label className="pc-deck-radio">
            <input
              type="radio"
              name="pc-deck-currency"
              checked={currency === 'EP'}
              disabled={activated}
              onChange={() => setCurrency('EP')}
            />
            {item.epCost} EP
          </label>
          <label className="pc-deck-radio">
            <input
              type="radio"
              name="pc-deck-currency"
              checked={currency === 'AP'}
              disabled={activated}
              onChange={() => setCurrency('AP')}
            />
            {item.epCost} AP
          </label>
        </fieldset>

        <div className="pc-deck-hotx">
          <span className="pc-deck-hotx-lab">Hot</span>
          <div className="pc-step">
            <button
              type="button"
              className="pc-btn"
              onClick={() => setHotX((x) => Math.max(1, x - 1))}
              disabled={activated}
              aria-label="Decrease Hot"
            >
              −
            </button>
            <span className="pc-step-num">{hotX}</span>
            <button
              type="button"
              className="pc-btn"
              onClick={() => setHotX((x) => x + 1)}
              disabled={activated}
              aria-label="Increase Hot"
            >
              +
            </button>
          </div>
          <span className={`pc-deck-hotx-proj${heatOk ? '' : ' is-over'}`}>
            Heat {projectedHeat}/{heatCap}
            {heatOk ? '' : ' — over cap'}
          </span>
        </div>

        <div className="pc-deck-controls">
          <button
            type="button"
            className="pc-deck-btn"
            onClick={() => setActivated(true)}
            disabled={activated || !heatOk}
          >
            {activated ? 'Activated' : 'Activate'}
          </button>
          <button type="button" className="pc-deck-btn" onClick={() => setRolled(true)}>
            Roll
          </button>
          <button
            type="button"
            className="pc-deck-btn pc-deck-btn-danger"
            disabled={!rolled}
            title="Reroll the d20, +2 Heat, forcing a Heat Check"
          >
            Push
          </button>
          <button
            type="button"
            className="pc-deck-btn"
            onClick={() => setApplied(true)}
            disabled={!rolled || applied}
            title="Commit this result"
          >
            {applied ? 'Applied' : 'Apply'}
          </button>
        </div>

        <div className="pc-deck-controls">
          <button
            type="button"
            className="pc-deck-back"
            onClick={() => {
              setActivated(false)
              setRolled(false)
              setApplied(false)
              setHotX(1)
            }}
          >
            Clear
          </button>
        </div>

        {rolled && (
          <div className="pc-deck-roll" data-band="MISHAP">
            <span className="pc-deck-d20">11</span>
            <div className="pc-deck-band">
              <strong>Tough Choice</strong>
              <span>Succeed, but at a cost — the GM offers a hard bargain.</span>
            </div>
          </div>
        )}
        {applied && <p className="pc-deck-applied">Result applied ✓</p>}
      </div>
    </div>
  )
}

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Actions Deck' }

/** Light display surface stand-in for the Dashboard's `pc-display` panel. */
function DisplayFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="pc-root pc-display-light"
      style={{ width: 380, height: 560, borderRadius: 5, border: '1.5px solid #282019' }}
    >
      {children}
    </div>
  )
}

export const Default: Story = () => {
  const groups = buildGroups()
  const [open, setOpen] = useState<DeckItem | null>(null)
  return (
    <div style={{ maxWidth: 420 }}>
      <Caption>
        ITUN Dashboard ActionsDeck — list view: timing tabs, group toggle, range selector + reach
        readout, real-source tags, and grouped action items (real SalvageUnionReference Actions).
        The last row in each group is out-of-range and DIMMED in place. Click a row to open the
        resolve panel.
      </Caption>
      <DisplayFrame>
        {open ? (
          <DeckPanel item={open} onBack={() => setOpen(null)} />
        ) : (
          <DeckList groups={groups} onOpen={setOpen} />
        )}
      </DisplayFrame>
    </div>
  )
}

export const ResolvePanel: Story = () => {
  const groups = buildGroups()
  const item = groups[0]?.items[0]
  if (!item) return <Caption>Actions fixture missing</Caption>
  return (
    <div style={{ maxWidth: 420 }}>
      <Caption>
        ActionsDeck resolve panel — Back/cost head, the reused ReferenceEntityDisplay card, the
        pay-with EP/AP radios, the Hot(X) `pc-step` stepper with a live heat-vs-cap projection, the
        Activate/Roll/Push/Apply controls, and the d20 roll readout.
      </Caption>
      <DisplayFrame>
        <DeckPanel item={item} onBack={() => undefined} />
      </DisplayFrame>
    </div>
  )
}
