/**
 * RowRules — What an opened row prints.
 *
 * A row's rules in full, in place under the row, as running text: the
 * entity's own action (its flavour, its effect), its roll table, then every
 * other action it grants as a named line with its Range, Damage and cost.
 * Nothing here is a card: the row above is the head, so the body needs none
 * (revision 2, rule 4). The name still Peeks and opens the Page.
 */

import type { ComponentProps } from 'react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { Content, capsLabel, EntityRollMini } from '../../components/index'
import { cn } from '../../lib/cn'
import { Cost } from './Cost'

/** A caps label: the condensed face in capitals (ruleset §3.12). */
const CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

type Body = ComponentProps<typeof Content>['body']

/** A model's facts as one quiet line: `TURN · RNG M · DMG 5 SP · EXPLOSIVE 1`. */
function marksOf(model: ReturnType<typeof toEntityModel>, skip: readonly string[] = []): string[] {
  return [
    ...(model.actionType
      ? [`${model.actionType === 'DownTime' ? 'Downtime' : model.actionType} action`]
      : []),
    ...model.facts
      .filter((fact) => fact.group === 'action' || fact.key === 'range' || fact.key === 'damage')
      .filter((fact) => !skip.includes(fact.key))
      .map((fact) => `${fact.label} ${fact.value}`),
    ...model.traits.map((trait) => (trait.param ? `${trait.name} ${trait.param}` : trait.name)),
  ]
}

export function RowRules({
  entity,
  chassisName,
}: {
  entity: RefMetaEntity
  /** A chassis ability names its chassis by a token; this fills it. */
  chassisName?: string
}) {
  const model = toEntityModel(entity)
  const actions = (SalvageUnionReference.resolveActions(entity) ?? []).filter(
    (action) => !action.hidden
  )
  const own = actions.filter((action) => action.name === entity.name)
  const others = actions.filter((action) => action.name !== entity.name)
  const ownContent =
    own.length > 0
      ? own.flatMap((action) => action.content ?? [])
      : 'content' in entity && Array.isArray(entity.content)
        ? entity.content
        : []
  const marks = marksOf(model)
  return (
    <div className="su-row-rules">
      {marks.length > 0 && (
        <p className={cn('su-row-rules__marks', CAPS, CAPS)}>{marks.join(' · ')}</p>
      )}
      {ownContent.length > 0 && (
        <div className="su-row-rules__text">
          <Content
            body={ownContent as Body}
            fontSize="sm"
            {...(chassisName ? { chassisName } : {})}
          />
        </div>
      )}
      <EntityRollMini entity={entity} full />
      {/* The table an own action rolls on (Escape Hatch) rides in the row too. */}
      {own.map((action) => (
        <EntityRollMini
          key={`roll-${action.id ?? action.name}`}
          entity={action as RefMetaEntity}
          full
        />
      ))}
      {others.map((action) => {
        const actionModel = toEntityModel(action)
        const actionMarks = marksOf(actionModel)
        return (
          <div key={action.id ?? action.name} className="su-row-rules__action">
            <p className="su-row-rules__action-head">
              <b>{action.name}</b>
              {actionMarks.length > 0 && (
                <span className={cn('su-row-rules__marks', CAPS, CAPS)}>
                  {actionMarks.join(' · ')}
                </span>
              )}
              {actionModel.cost && <Cost cost={actionModel.cost} />}
            </p>
            <div className="su-row-rules__text">
              <Content
                body={(action.content ?? []) as Body}
                fontSize="sm"
                {...(chassisName ? { chassisName } : {})}
              />
            </div>
            <EntityRollMini entity={action as RefMetaEntity} full />
          </div>
        )
      })}
    </div>
  )
}
