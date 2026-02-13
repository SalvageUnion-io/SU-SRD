import { useState, useMemo } from 'react'
import { ActionFilterChips, EntityDisplay } from 'suref-react'
import { ActionCard } from './ActionCard'
import { useEntityRefs, useUpdateEntityRef } from '../../../hooks/useEntityRefs'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEnumSchemaName, SURefAbility, SURefEntity } from 'salvageunion-reference'
import type { EntityRef, ItemCondition } from '../../../types/common'

type ActionsViewProps = {
  pilotId: string
  mechId?: string
}

type HydratedAction = {
  entityRef: EntityRef
  name: string
  description: string
  actionType: string
  source: string
  apCost?: number
  epCost?: number
  range?: string
  damage?: string
  traits?: string[]
  condition?: ItemCondition
}

function hydrateEntityRef(ref: EntityRef): HydratedAction | null {
  const entity = SalvageUnionReference.get(
    ref.schema_name as SURefEnumSchemaName,
    ref.schema_ref_id
  )
  if (!entity) return null

  // Cast to Record for dynamic property access - entity types vary by schema
  const e = entity as Record<string, unknown>

  const activationCost = e.activationCost as { type?: string; amount?: number } | undefined
  const traits = e.traits as Array<{ name?: string; id?: string }> | undefined

  return {
    entityRef: ref,
    name: (e.name as string) ?? ref.schema_ref_id,
    description: (e.description as string) ?? '',
    actionType: activationCost?.type ?? (e.actionType as string) ?? '',
    source: `${ref.schema_name} - ${ref.schema_ref_id}`,
    apCost: activationCost?.amount,
    epCost: e.energyCost as number | undefined,
    range: e.range as string | undefined,
    damage: e.damage as string | undefined,
    traits: traits?.map((t) => t.name ?? t.id ?? ''),
    condition: ref.condition,
  }
}

const genericAbilities = SalvageUnionReference.Abilities.findAll(
  (a) => (a as SURefAbility).level === 'G'
) as (SURefAbility & { schemaName: string })[]

export function ActionsView({ pilotId, mechId }: ActionsViewProps) {
  const [filter, setFilter] = useState('all')

  const { data: pilotRefs = [] } = useEntityRefs('pilot', pilotId)
  const { data: mechRefs = [] } = useEntityRefs('mech', mechId ?? '')
  const updatePilotRef = useUpdateEntityRef('pilot', pilotId)
  const updateMechRef = useUpdateEntityRef('mech', mechId ?? '')

  const actions = useMemo(() => {
    const all: HydratedAction[] = []

    for (const ref of pilotRefs) {
      const hydrated = hydrateEntityRef(ref)
      if (hydrated) all.push(hydrated)
    }

    for (const ref of mechRefs) {
      const hydrated = hydrateEntityRef(ref)
      if (hydrated) all.push(hydrated)
    }

    if (filter === 'all' || filter === 'generic') return all
    return all.filter((a) => a.actionType.toLowerCase() === filter.toLowerCase())
  }, [pilotRefs, mechRefs, filter])

  const filteredGenerics = useMemo(() => {
    if (filter === 'generic') return genericAbilities
    if (filter === 'all') return genericAbilities
    return genericAbilities.filter(
      (a) => a.mechActionType && a.mechActionType.toLowerCase() === filter.toLowerCase()
    )
  }, [filter])

  const handleConditionChange = (action: HydratedAction, condition: ItemCondition) => {
    const mutation = action.entityRef.parent_type === 'pilot' ? updatePilotRef : updateMechRef
    mutation.mutate({ id: action.entityRef.id, input: { condition } })
  }

  const showEmptyState = actions.length === 0 && filteredGenerics.length === 0

  return (
    <div className="space-y-3 p-4">
      <ActionFilterChips selected={filter} onChange={setFilter} />

      {showEmptyState && (
        <p className="py-8 text-center text-sm text-su-grey">
          No actions available. Add abilities, systems, or modules to see actions here.
        </p>
      )}

      {/* Entity-ref-backed actions */}
      {filter !== 'generic' && actions.length > 0 && (
        <div className="space-y-2">
          {actions.map((action) => (
            <ActionCard
              key={action.entityRef.id}
              name={action.name}
              description={action.description}
              actionType={action.actionType}
              source={action.source}
              apCost={action.apCost}
              epCost={action.epCost}
              range={action.range}
              damage={action.damage}
              traits={action.traits}
              condition={action.condition}
              onConditionChange={(c) => handleConditionChange(action, c)}
            />
          ))}
        </div>
      )}

      {/* Generic abilities */}
      {filteredGenerics.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-su-grey-dark">
            Generic Abilities
          </h3>
          {filteredGenerics.map((ability) => (
            <EntityDisplay
              key={ability.id}
              data={ability as unknown as SURefEntity}
              compact
              collapsible
              hidePatterns
              hideActions
            />
          ))}
        </div>
      )}
    </div>
  )
}
