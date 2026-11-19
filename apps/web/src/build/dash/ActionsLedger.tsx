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
import { ActivationCost, Content, Stat, TraitProse } from '../../components/index'
import type { PlayAction } from '../../lib/rules/actionList'
import { actionRow } from '../../lib/rules/actionRow'
import { buildSheetCopy } from '../../messages/build-sheet'
import { ACTION_TYPE_ORDER, actionTypeOf } from '../../play/playActions.model'
import type { OpenColumn, OpenRow } from './OpenLedger'
import { OpenLedger } from './OpenLedger'

const GROUPED = { grouped: true } as const

const COLUMNS: readonly OpenColumn[] = [
  { key: 'range', label: buildSheetCopy('rng'), title: buildSheetCopy('range') },
  { key: 'damage', label: buildSheetCopy('dmg'), title: buildSheetCopy('damage') },
  {
    key: 'cost',
    label: buildSheetCopy('cost'),
    title: buildSheetCopy('activationCost'),
    phone: true,
  },
]

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
export function ActionsLedger({ actions }: { actions: readonly PlayAction[] }) {
  const groups = ACTION_TYPE_ORDER.map((type) => ({
    type,
    rows: actions.filter((action) => actionTypeOf(action.action) === type).map(row),
  })).filter((group) => group.rows.length > 0)
  if (groups.length === 0) return <p className="su-open__empty">{buildSheetCopy('noActionsYet')}</p>
  return (
    <section className="su-actions-view" aria-label={buildSheetCopy('actions')}>
      {groups.map((group) => (
        <OpenLedger
          key={group.type}
          title={group.type}
          // MOCK: "actions" belongs in the message catalogue.
          note={`${group.rows.length} ${group.rows.length === 1 ? 'action' : 'actions'}`}
          columns={COLUMNS}
          groups={[{ key: group.type, rows: group.rows }]}
        />
      ))}
    </section>
  )
}
