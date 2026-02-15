import { useState, useMemo, useCallback } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { DisplayCard, Text } from 'suref-react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { EntitySelectionModal } from './EntitySelectionModal'
import type { BuilderState, ResolvedItem } from '../../lib/builderUtils'
import {
  resolvePatternItems,
  computeCapacity,
  nextSortOrder,
  builderToCreateInput,
} from '../../lib/builderUtils'
import type { CreatePatternInput } from '../../types/common'

type MechBuilderProps = {
  initialState?: BuilderState
  onSave: (input: CreatePatternInput) => void
  onCancel: () => void
  isSaving?: boolean
  // Future Phase 3 props
  scrapBudget?: number
  techLevelFilter?: number
}

const emptyState: BuilderState = {
  name: '',
  chassisRef: null,
  description: '',
  items: [],
}

type ModalTarget = 'chassis' | 'systems' | 'modules' | null

export function MechBuilder({ initialState, onSave, onCancel, isSaving }: MechBuilderProps) {
  const [state, setState] = useState<BuilderState>(initialState ?? emptyState)
  const [modalTarget, setModalTarget] = useState<ModalTarget>(null)

  const chassis = useMemo(
    () =>
      state.chassisRef
        ? SalvageUnionReference.Chassis.find((c) => c.id === state.chassisRef)
        : undefined,
    [state.chassisRef]
  )

  const resolvedItems = useMemo(() => resolvePatternItems(state.items), [state.items])

  const capacity = useMemo(
    () => computeCapacity(chassis ?? null, resolvedItems),
    [chassis, resolvedItems]
  )

  const systemItems = useMemo(
    () => resolvedItems.filter((i) => i.schema_name === 'systems'),
    [resolvedItems]
  )

  const moduleItems = useMemo(
    () => resolvedItems.filter((i) => i.schema_name === 'modules'),
    [resolvedItems]
  )

  const canSave = useMemo(() => {
    const input = builderToCreateInput(state)
    return input !== null && capacity.isValid
  }, [state, capacity.isValid])

  const handleSave = useCallback(() => {
    const input = builderToCreateInput(state)
    if (input && capacity.isValid) {
      onSave(input)
    }
  }, [state, capacity.isValid, onSave])

  function setName(name: string) {
    setState((s) => ({ ...s, name }))
  }

  function selectChassis(chassisId: string) {
    setState((s) => ({ ...s, chassisRef: chassisId }))
  }

  function addItem(schemaName: 'systems' | 'modules', entityId: string) {
    setState((s) => ({
      ...s,
      items: [
        ...s.items,
        {
          schema_name: schemaName,
          schema_ref_id: entityId,
          sort_order: nextSortOrder(s.items),
        },
      ],
    }))
  }

  function removeItem(sortOrder: number) {
    setState((s) => ({
      ...s,
      items: s.items.filter((i) => i.sort_order !== sortOrder),
    }))
  }

  function handleModalSelect(entityId: string) {
    if (modalTarget === 'chassis') {
      selectChassis(entityId)
    } else if (modalTarget === 'systems' || modalTarget === 'modules') {
      addItem(modalTarget, entityId)
    }
    setModalTarget(null)
  }

  return (
    <>
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={
          <div className="flex w-full flex-col gap-1 px-2 py-1">
            <Input
              placeholder="Pattern name..."
              value={state.name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 border-none bg-transparent p-0 text-lg font-bold text-su-white placeholder:text-su-white/50 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {chassis && (
              <div className="flex items-center gap-2 text-xs text-su-white/80">
                <span>{chassis.name}</span>
                <span className="text-su-white/50">|</span>
                <span>SP {chassis.structurePoints}</span>
                <span>EP {chassis.energyPoints}</span>
                <span>HC {chassis.heatCapacity}</span>
                <span className="text-su-white/50">|</span>
                <span>
                  Sys {capacity.systemSlotsUsed}/{capacity.systemSlotsTotal}
                </span>
                <span>
                  Mod {capacity.moduleSlotsUsed}/{capacity.moduleSlotsTotal}
                </span>
              </div>
            )}
          </div>
        }
        footerContent={
          <div className="flex w-full items-center justify-between px-2 py-1">
            <div className="flex items-center gap-2 text-xs">
              <SlotBadge
                label="Sys"
                used={capacity.systemSlotsUsed}
                total={capacity.systemSlotsTotal}
                isOver={capacity.isOverSystemCapacity}
              />
              <SlotBadge
                label="Mod"
                used={capacity.moduleSlotsUsed}
                total={capacity.moduleSlotsTotal}
                isOver={capacity.isOverModuleCapacity}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!canSave || isSaving}>
                {isSaving ? 'Saving...' : 'Save Pattern'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4 p-3">
          {/* Chassis Section */}
          <section>
            <Text variant="pseudoheader" as="div" className="mb-2 text-xs text-su-orange uppercase">
              Chassis
            </Text>
            {chassis ? (
              <DisplayCard
                mode="listing"
                headerBg="bg-su-dark-light"
                headerContent={
                  <div className="flex w-full items-center justify-between px-2">
                    <span className="text-sm font-medium text-su-white">{chassis.name}</span>
                    <span className="text-xs text-su-grey-dark">
                      TL{chassis.techLevel} &middot; {chassis.systemSlots}S/{chassis.moduleSlots}M
                    </span>
                  </div>
                }
                onClick={() => setModalTarget('chassis')}
              />
            ) : (
              <Button
                variant="outline"
                className="w-full border-dashed border-su-grey-light/30 text-su-grey-dark"
                onClick={() => setModalTarget('chassis')}
              >
                <Plus className="mr-1 h-4 w-4" />
                Select Chassis
              </Button>
            )}
          </section>

          {/* Systems Section */}
          <section>
            <Text variant="pseudoheader" as="div" className="mb-2 text-xs text-su-orange uppercase">
              Systems ({capacity.systemSlotsUsed}/{capacity.systemSlotsTotal})
            </Text>
            <div className="flex flex-col gap-1">
              <ItemList items={systemItems} onRemove={removeItem} />
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed border-su-grey-light/30 text-su-grey-dark"
                onClick={() => setModalTarget('systems')}
                disabled={!chassis}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add System
              </Button>
            </div>
          </section>

          {/* Modules Section */}
          <section>
            <Text variant="pseudoheader" as="div" className="mb-2 text-xs text-su-orange uppercase">
              Modules ({capacity.moduleSlotsUsed}/{capacity.moduleSlotsTotal})
            </Text>
            <div className="flex flex-col gap-1">
              <ItemList items={moduleItems} onRemove={removeItem} />
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed border-su-grey-light/30 text-su-grey-dark"
                onClick={() => setModalTarget('modules')}
                disabled={!chassis}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add Module
              </Button>
            </div>
          </section>
        </div>
      </DisplayCard>

      {/* Entity Selection Modal */}
      {modalTarget && (
        <EntitySelectionModal
          open={!!modalTarget}
          onOpenChange={(open) => {
            if (!open) setModalTarget(null)
          }}
          title={
            modalTarget === 'chassis'
              ? 'Select Chassis'
              : modalTarget === 'systems'
                ? 'Add System'
                : 'Add Module'
          }
          schemaName={modalTarget}
          onSelect={handleModalSelect}
        />
      )}
    </>
  )
}

function ItemList({
  items,
  onRemove,
}: {
  items: ResolvedItem[]
  onRemove: (sortOrder: number) => void
}) {
  if (items.length === 0) return null

  return (
    <>
      {items.map((item) => (
        <DisplayCard
          key={item.sort_order}
          mode="listing"
          headerBg="bg-su-dark-light"
          headerContent={
            <div className="flex w-full items-center justify-between px-2">
              <span className="truncate text-sm text-su-white">{item.entity.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-su-grey-dark">
                  {item.entity.slotsRequired} slot{item.entity.slotsRequired !== 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(item.sort_order)
                  }}
                  className="rounded p-0.5 text-su-grey-dark hover:text-su-rust"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          }
        />
      ))}
    </>
  )
}

function SlotBadge({
  label,
  used,
  total,
  isOver,
}: {
  label: string
  used: number
  total: number
  isOver: boolean
}) {
  return (
    <Badge variant={isOver ? 'destructive' : 'secondary'} className="text-xs">
      {label} {used}/{total}
    </Badge>
  )
}
