/**
 * ActionsLedger — MOCK (density mock, sheet variant): what a unit does, as
 * rows (R65: every action, by action type, in the list's own order).
 *
 * One open ledger: Range, Damage and the cost in fixed columns named once on
 * the section's rule, a sub-group a type (Turn, Short, Long, Reaction, Free,
 * Downtime, Passive). A row is the action Play draws (`actionRow`, the
 * owner's picks applied): its name Peeks the whole card, its traits and the
 * item it comes from follow in quiet caps, its effect is the line under it.
 * The sheet reads here: Use is Play's (ADR-021).
 */

import type { ComponentProps } from 'react'
import { useState } from 'react'
import {
  ActivationCost,
  Content,
  SearchField,
  Segmented,
  SegmentedOption,
  Stat,
  TraitProse,
} from '../../components/index'
import type { PlayAction } from '../../lib/rules/actionList'
import { actionRow } from '../../lib/rules/actionRow'
import { buildSheetCopy } from '../../messages/build-sheet'
import { ACTION_TYPE_ORDER, actionTypeOf } from '../../play/playActions.model'
import type { OpenColumn, OpenRow } from './OpenLedger'
import { OpenLedger } from './OpenLedger'

const GROUPED = { grouped: true } as const

/** "2 EP" as the book's pointy box. */
export function Cost({ cost }: { cost: string | undefined }) {
  if (!cost) return null
  const cut = cost.lastIndexOf(' ')
  return cut === -1 ? (
    <ActivationCost cost={cost} currency="" size="mini" />
  ) : (
    <ActivationCost cost={cost.slice(0, cut)} currency={cost.slice(cut + 1)} size="mini" />
  )
}

function row(action: PlayAction): OpenRow {
  const { model, summary, effect } = actionRow(action, GROUPED)
  const short = (key: string) => {
    const found = model.facts.find((fact) => fact.key === key)
    return found ? (found.shortValue ?? found.value) : ''
  }
  // Range and Damage are columns; every other fact and trait follows the name.
  const marks = [
    ...model.facts
      .filter((fact) => fact.key !== 'range' && fact.key !== 'damage')
      .map((fact) => `${fact.short} ${fact.shortValue ?? fact.value}`),
    ...model.traits.map((trait) => (trait.param ? `${trait.name} ${trait.param}` : trait.name)),
    // The item it comes from, where its own name does not say it.
    ...(action.name.includes(action.ownerName) ? [] : [action.ownerName]),
  ]
  const destroyed = action.condition === 'destroyed'
  // A phone has no room for the Range and Damage columns: they lead the marks.
  const reach = model.facts
    .filter((fact) => fact.key === 'range' || fact.key === 'damage')
    .map((fact) => `${fact.short} ${fact.shortValue ?? fact.value}`)
  return {
    id: action.key,
    name: model.title,
    entityRef: model.ref,
    meta:
      marks.length > 0 || reach.length > 0 ? (
        <>
          {reach.length > 0 && (
            <span className="su-open__phone-only">
              {reach.join(' · ')}
              {marks.length > 0 ? ' · ' : ''}
            </span>
          )}
          {marks.join(' · ')}
        </>
      ) : undefined,
    state: (
      <>
        {action.companion && <Stat size="mini" label={action.companion.name} />}
        {action.condition !== 'intact' && (
          <Stat size="mini" label={action.condition} state="critical" />
        )}
      </>
    ),
    cells: [
      short('range'),
      short('damage'),
      model.cost ? <Cost key="cost" cost={model.cost} /> : '',
    ],
    under: summary ? <TraitProse as="p" className="su-open__clamp" text={summary} /> : undefined,
    // Opened, the effect prints whole in place of its two-line summary.
    detail:
      effect.length > 0 ? (
        <div className="su-row-rules">
          <div className="su-row-rules__text">
            <Content body={effect as ComponentProps<typeof Content>['body']} fontSize="sm" />
          </div>
        </div>
      ) : undefined,
    detailLabel: `${model.title} in full`,
    dim: destroyed,
  }
}

/**
 * The Actions view (best variant): one small ledger an action type, set in
 * columns, so a turn's choices read across the screen rather than down one
 * long list (COMP/CON's and Foundry's action-economy grouping). A row's
 * effect is two lines until it is opened; opened, it prints whole.
 */
// MOCK (best, revision 4): the Actions view is a tool, not a set of columned
// tables: one search box, three rows of filter chips (action type, where it
// comes from, whether it costs), and ONE list whose rows keep the effect
// readable (three lines closed, the whole text opened). The words belong in
// the message catalogue.
const SOURCE_LABEL: Record<PlayAction['kind'], string> = {
  ability: 'Abilities',
  equipment: 'Equipment',
  system: 'Systems',
  module: 'Modules',
  chassis: 'Chassis',
}

type CostFilter = 'all' | 'free' | 'costs'

const LIST_COLUMNS: readonly OpenColumn[] = [
  { key: 'type', label: 'Type', kind: 'text', phone: true },
  {
    key: 'cost',
    label: buildSheetCopy('cost'),
    title: buildSheetCopy('activationCost'),
    phone: true,
  },
]

function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly { key: T; label: string; count?: number }[]
  value: T
  onChange: (next: T) => void
}) {
  return (
    <Segmented label={label} size="compact" wrap className="su-actions-tool__chips">
      {options.map((option) => (
        <SegmentedOption
          key={option.key}
          pressed={value === option.key}
          onClick={() => onChange(option.key)}
        >
          {option.label}
          {option.count !== undefined && (
            <span className="su-mast__view-count">{option.count}</span>
          )}
        </SegmentedOption>
      ))}
    </Segmented>
  )
}

function toolRow(action: PlayAction): OpenRow {
  const base = row(action)
  const { model } = actionRow(action, GROUPED)
  const reach = model.facts
    .filter((fact) => fact.key === 'range' || fact.key === 'damage')
    .map((fact) => `${fact.short} ${fact.shortValue ?? fact.value}`)
  const marks = [
    ...reach,
    ...model.facts
      .filter((fact) => fact.key !== 'range' && fact.key !== 'damage')
      .map((fact) => `${fact.short} ${fact.shortValue ?? fact.value}`),
    ...model.traits.map((trait) => (trait.param ? `${trait.name} ${trait.param}` : trait.name)),
    ...(action.name.includes(action.ownerName) ? [] : [action.ownerName]),
  ]
  const type = actionTypeOf(action.action)
  return {
    ...base,
    meta: marks.length > 0 ? marks.join(' · ') : undefined,
    cells: [type, model.cost ? <Cost key="cost" cost={model.cost} /> : ''],
  }
}

export function ActionsLedger({ actions }: { actions: readonly PlayAction[] }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<string>('all')
  const [source, setSource] = useState<string>('all')
  const [cost, setCost] = useState<CostFilter>('all')
  if (actions.length === 0)
    return <p className="su-open__empty">{buildSheetCopy('noActionsYet')}</p>

  const types = ACTION_TYPE_ORDER.filter((each) =>
    actions.some((action) => actionTypeOf(action.action) === each)
  )
  const sources = (Object.keys(SOURCE_LABEL) as PlayAction['kind'][]).filter((kind) =>
    actions.some((action) => action.kind === kind)
  )
  const costs = (action: PlayAction) => Boolean(actionRow(action, GROUPED).model.cost)
  const needle = query.trim().toLowerCase()
  const shown = actions.filter((action) => {
    if (type !== 'all' && actionTypeOf(action.action) !== type) return false
    if (source !== 'all' && action.kind !== source) return false
    if (cost === 'free' && costs(action)) return false
    if (cost === 'costs' && !costs(action)) return false
    if (!needle) return true
    const { model, summary } = actionRow(action, GROUPED)
    return [action.name, action.ownerName, summary ?? '', ...model.traits.map((t) => t.name)]
      .join(' ')
      .toLowerCase()
      .includes(needle)
  })
  // Listed in the order a turn is spent: by action type, then as the sheet lists them.
  const ordered = ACTION_TYPE_ORDER.flatMap((each) =>
    shown.filter((action) => actionTypeOf(action.action) === each)
  )
  const filtered = shown.length !== actions.length
  return (
    <section className="su-actions-tool" aria-label={buildSheetCopy('actions')}>
      <div className="su-actions-tool__bar">
        <SearchField
          containerClassName="su-actions-tool__search"
          type="search"
          aria-label="Search actions"
          placeholder="Search actions by name, trait or text"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <Chips
          label="Action type"
          value={type}
          onChange={setType}
          options={[
            { key: 'all', label: 'All', count: actions.length },
            ...types.map((each) => ({
              key: each as string,
              label: each as string,
              count: actions.filter((action) => actionTypeOf(action.action) === each).length,
            })),
          ]}
        />
        {sources.length > 1 && (
          <Chips
            label="From"
            value={source}
            onChange={setSource}
            options={[
              { key: 'all', label: 'Any source' },
              ...sources.map((kind) => ({ key: kind as string, label: SOURCE_LABEL[kind] })),
            ]}
          />
        )}
        <Chips
          label="Cost"
          value={cost}
          onChange={setCost}
          options={[
            { key: 'all', label: 'Any cost' },
            { key: 'free', label: 'No cost' },
            { key: 'costs', label: 'Costs AP / EP' },
          ]}
        />
      </div>
      <OpenLedger
        title={buildSheetCopy('actions')}
        note={filtered ? `${shown.length} of ${actions.length} shown` : `${actions.length} actions`}
        columns={LIST_COLUMNS}
        groups={[{ key: 'actions', rows: ordered.map(toolRow) }]}
        empty="No action matches. Clear the search or a filter."
        className="su-open--actions"
      />
    </section>
  )
}
