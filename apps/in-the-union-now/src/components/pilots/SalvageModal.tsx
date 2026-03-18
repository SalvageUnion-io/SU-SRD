import { useState, useMemo, useCallback } from 'react'
import { ModalShell, Text, ReferenceEntityDisplay, addControl } from 'suref-react'
import { SalvageUnionReference, getSalvageValue } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { useAddMechCargo } from '../../hooks/useMechs'
import { resolveSalvageRoll, computeCargoFit } from '../../lib/salvageUtils'
import type { SalvageType } from '../../lib/salvageUtils'
import { getEntityId } from '../../lib/entitySelectionUtils'
import type { CargoRow } from '../../types/common'

// --- Types ---

type SalvagePhase = 'select-type' | 'roll' | 'results' | 'select-items' | 'confirm'

type SalvageModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mechId: string
  userId: string
  currentCargo: CargoRow[]
  mechMaxCargo: number
}

type SalvageResultItem = {
  entity: SURefEntity
  entityId: string
  schemaName: string
  name: string
  salvageValue: number
}

// --- Helpers ---

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1
}

/**
 * Resolve Area Salvage or Mech Salvage roll table result into entity candidates.
 * The tables return item names; we look them up in the reference data.
 */
function resolveResultToEntities(resultValue: string): SalvageResultItem[] {
  // Search all salvageable schemas for entities matching the result label
  const schemas = ['systems', 'modules', 'chassis'] as const
  const found: SalvageResultItem[] = []

  for (const schema of schemas) {
    let entities: SURefEntity[] = []
    if (schema === 'systems') entities = SalvageUnionReference.Systems.all()
    else if (schema === 'modules') entities = SalvageUnionReference.Modules.all()
    else if (schema === 'chassis') entities = SalvageUnionReference.Chassis.all()

    for (const entity of entities) {
      const name = 'name' in entity ? (entity.name as string) : ''
      if (name.toLowerCase() === resultValue.toLowerCase()) {
        const sv = getSalvageValue(entity) ?? 1
        const id = getEntityId(entity)
        const schemaName = 'schemaName' in entity ? (entity.schemaName as string) : schema
        found.push({ entity, entityId: id, schemaName, name, salvageValue: sv })
      }
    }
  }

  return found
}

// --- SalvageModal ---

/**
 * Post-combat Salvage Modal.
 *
 * Phases:
 * 1. select-type  — Choose Area Salvage or Mech Salvage
 * 2. roll         — Enter d20 roll; look up result on the table
 * 3. results      — Display roll result text
 * 4. select-items — Pick items to load (capacity-validated)
 * 5. confirm      — Write selected items to mech cargo via useAddMechCargo
 *
 * Post-combat only. For downtime salvage offloading, use the Tally Salvage step.
 */
export function SalvageModal({
  open,
  onOpenChange,
  mechId,
  userId,
  currentCargo,
  mechMaxCargo,
}: SalvageModalProps) {
  const [phase, setPhase] = useState<SalvagePhase>('select-type')
  const [salvageType, setSalvageType] = useState<SalvageType | null>(null)
  const [sourceMechLabel, setSourceMechLabel] = useState('')
  const [rollValue, setRollValue] = useState<number | null>(null)
  const [rollInput, setRollInput] = useState('')
  const [resultText, setResultText] = useState<string | null>(null)
  const [resultItems, setResultItems] = useState<SalvageResultItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isConfirming, setIsConfirming] = useState(false)

  const addCargo = useAddMechCargo()

  // Current remaining capacity accounts for already-selected items in this session
  const remainingCapacity = useMemo(() => {
    return computeCargoFit(currentCargo, mechMaxCargo)
  }, [currentCargo, mechMaxCargo])

  // Running tally: how many slots will be consumed if selected items are added
  const selectedSlotsUsed = useMemo(() => {
    return resultItems
      .filter((item) => selectedIds.has(item.entityId))
      .reduce((sum, item) => sum + item.salvageValue, 0)
  }, [resultItems, selectedIds])

  const slotsAfterSelection = remainingCapacity - selectedSlotsUsed

  const handleDismiss = useCallback(() => {
    setPhase('select-type')
    setSalvageType(null)
    setSourceMechLabel('')
    setRollValue(null)
    setRollInput('')
    setResultText(null)
    setResultItems([])
    setSelectedIds(new Set())
    setIsConfirming(false)
    onOpenChange(false)
  }, [onOpenChange])

  const handleSelectType = useCallback((type: SalvageType) => {
    setSalvageType(type)
    setPhase('roll')
  }, [])

  const handleRoll = useCallback(() => {
    const roll = rollD20()
    setRollValue(roll)
    setRollInput(String(roll))
  }, [])

  const handleRollInputChange = useCallback((value: string) => {
    setRollInput(value)
    const parsed = parseInt(value, 10)
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 20) {
      setRollValue(parsed)
    }
  }, [])

  const handleLookupRoll = useCallback(() => {
    if (!salvageType || rollValue === null) return
    const tableName = salvageType === 'area' ? 'Area Salvage' : 'Mech Salvage'
    const result = resolveSalvageRoll(tableName, rollValue)
    const text = result.success ? result.result.value : 'No result found.'
    setResultText(text)
    const items = result.success ? resolveResultToEntities(result.result.value) : []
    setResultItems(items)
    setPhase('results')
  }, [salvageType, rollValue])

  const handleProceedToSelectItems = useCallback(() => {
    setPhase('select-items')
  }, [])

  const handleToggleItem = useCallback(
    (entityId: string, salvageValue: number) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(entityId)) {
          next.delete(entityId)
          return next
        }
        // Only allow adding if it fits
        const currentUsed = resultItems
          .filter((item) => next.has(item.entityId))
          .reduce((sum, item) => sum + item.salvageValue, 0)
        if (currentUsed + salvageValue > remainingCapacity) return prev
        next.add(entityId)
        return next
      })
    },
    [resultItems, remainingCapacity]
  )

  const handleConfirm = useCallback(() => {
    if (selectedIds.size === 0) {
      handleDismiss()
      return
    }

    const itemsToAdd = resultItems.filter((item) => selectedIds.has(item.entityId))
    setIsConfirming(true)

    let completed = 0
    const total = itemsToAdd.length

    for (const item of itemsToAdd) {
      const metadata: Record<string, unknown> =
        salvageType === 'mech'
          ? {
              source_label: sourceMechLabel || null,
              encounter_participant_id: null,
            }
          : {}

      addCargo.mutate(
        {
          parentId: mechId,
          userId,
          input: {
            name: item.name,
            schema_name: item.schemaName,
            schema_ref_id: item.entityId,
            ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
          },
        },
        {
          onSuccess: () => {
            completed++
            if (completed === total) {
              setIsConfirming(false)
              handleDismiss()
            }
          },
          onError: () => {
            setIsConfirming(false)
          },
        }
      )
    }
  }, [
    selectedIds,
    resultItems,
    salvageType,
    sourceMechLabel,
    mechId,
    userId,
    addCargo,
    handleDismiss,
  ])

  const tableLabel = salvageType === 'area' ? 'Area Salvage' : 'Mech Salvage'

  return (
    <ModalShell
      open={open}
      onOpenChange={handleDismiss}
      title="Post-Combat Salvage"
      description="Post-combat only. For downtime salvage offloading, use the Tally Salvage step."
      headerBg="bg-su-green"
      maxWidth="max-w-md"
      align="center"
    >
      <div className="space-y-4 p-4">
        {/* Phase 1: Select salvage type */}
        {phase === 'select-type' && (
          <>
            <Text as="p" className="text-sm text-su-black/80">
              Select the type of salvage to roll on.
            </Text>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSelectType('area')}
                className="flex flex-col items-center gap-2 rounded-md border-2 border-su-green bg-su-green/10 p-4 font-mono font-semibold uppercase text-su-black transition-colors hover:bg-su-green/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-su-green"
                aria-label="Area Salvage"
              >
                <span className="text-base">Area Salvage</span>
                <span className="text-xs font-normal normal-case text-su-black/60">
                  Items found in the area
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectType('mech')}
                className="flex flex-col items-center gap-2 rounded-md border-2 border-su-green bg-su-green/10 p-4 font-mono font-semibold uppercase text-su-black transition-colors hover:bg-su-green/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-su-green"
                aria-label="Mech Salvage"
              >
                <span className="text-base">Mech Salvage</span>
                <span className="text-xs font-normal normal-case text-su-black/60">
                  Parts from a destroyed mech
                </span>
              </button>
            </div>
          </>
        )}

        {/* Phase 2: Roll */}
        {phase === 'roll' && (
          <>
            <Text as="p" className="text-sm font-semibold text-su-black">
              {tableLabel}
            </Text>
            <Text as="p" className="text-sm text-su-black/80">
              Roll a d20 and enter your result, or use the Roll button.
            </Text>

            {salvageType === 'mech' && (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="source-mech-label"
                  className="text-xs font-bold uppercase tracking-wide text-su-black/70"
                >
                  Source Mech (optional)
                </label>
                <Input
                  id="source-mech-label"
                  value={sourceMechLabel}
                  onChange={(e) => setSourceMechLabel(e.target.value)}
                  placeholder="e.g. Iron Mongrel wreck"
                  className="border-su-grey-dark/40 bg-su-white text-su-black placeholder:text-su-grey-dark"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="roll-value"
                className="text-xs font-bold uppercase tracking-wide text-su-black/70"
              >
                d20 Roll (1–20)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="roll-value"
                  type="number"
                  min={1}
                  max={20}
                  value={rollInput}
                  onChange={(e) => handleRollInputChange(e.target.value)}
                  placeholder="—"
                  className="w-24 border-su-grey-dark/40 bg-su-white text-center font-mono text-base font-bold text-su-black placeholder:text-su-grey-dark"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRoll}
                  className="font-mono text-xs uppercase"
                >
                  Roll d20
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-su-grey-light/30 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPhase('select-type')}
              >
                Back
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleLookupRoll}
                disabled={rollValue === null}
                className="bg-su-green text-su-white hover:bg-emerald-600 font-mono text-xs uppercase"
              >
                Look Up Result
              </Button>
            </div>
          </>
        )}

        {/* Phase 3: Results */}
        {phase === 'results' && (
          <>
            <div className="rounded border border-su-green/40 bg-su-green/10 p-3 space-y-2">
              <Text as="p" className="text-xs font-semibold uppercase text-su-black/60">
                {tableLabel} — Roll:{' '}
                <span className="font-mono font-bold text-su-black">{rollValue}</span>
              </Text>
              {resultText && (
                <Text as="p" className="text-sm text-su-black/80">
                  {resultText}
                </Text>
              )}
            </div>

            {resultItems.length > 0 ? (
              <Text as="p" className="text-sm text-su-black/70">
                {resultItems.length} item{resultItems.length !== 1 ? 's' : ''} found matching this
                result. Proceed to select items to load.
              </Text>
            ) : (
              <Text as="p" className="text-sm text-su-black/70">
                No specific items matched this roll result — resolve manually.
              </Text>
            )}

            <div className="flex items-center justify-between border-t border-su-grey-light/30 pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setPhase('roll')}>
                Back
              </Button>
              {resultItems.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleProceedToSelectItems}
                  className="bg-su-green text-su-white hover:bg-emerald-600 font-mono text-xs uppercase"
                >
                  Select Items
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={handleDismiss}>
                  Done
                </Button>
              )}
            </div>
          </>
        )}

        {/* Phase 4: Select items */}
        {phase === 'select-items' && (
          <>
            <div className="flex items-center justify-between">
              <Text as="p" className="text-sm font-semibold text-su-black">
                Select items to load
              </Text>
              <Text as="span" className="font-mono text-xs text-su-black/60">
                {slotsAfterSelection} slots remaining
              </Text>
            </div>

            <div
              className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-1"
              style={{ scrollbarGutter: 'stable' }}
            >
              {resultItems.map((item) => {
                const isSelected = selectedIds.has(item.entityId)
                const wouldExceedCapacity =
                  !isSelected &&
                  (() => {
                    const currentUsed = resultItems
                      .filter((i) => selectedIds.has(i.entityId))
                      .reduce((sum, i) => sum + i.salvageValue, 0)
                    return currentUsed + item.salvageValue > remainingCapacity
                  })()

                if (wouldExceedCapacity) {
                  return (
                    <div
                      key={item.entityId}
                      className="pointer-events-none rounded-md opacity-50 ring-2 ring-su-rust/50"
                    >
                      <ReferenceEntityDisplay data={item.entity} compact disabled />
                    </div>
                  )
                }

                return (
                  <div
                    key={item.entityId}
                    className={isSelected ? 'rounded-md ring-2 ring-su-green' : undefined}
                  >
                    <ReferenceEntityDisplay
                      data={item.entity}
                      compact
                      controls={[
                        {
                          ...addControl(() => handleToggleItem(item.entityId, item.salvageValue)),
                          hidden: false,
                          cardClick: false,
                        },
                      ]}
                    />
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between border-t border-su-grey-light/30 pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setPhase('results')}>
                Back
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setPhase('confirm')}
                disabled={selectedIds.size === 0}
                className="bg-su-green text-su-white hover:bg-emerald-600 font-mono text-xs uppercase disabled:opacity-50"
              >
                Confirm ({selectedIds.size})
              </Button>
            </div>
          </>
        )}

        {/* Phase 5: Confirm */}
        {phase === 'confirm' && (
          <>
            <Text as="p" className="text-sm font-semibold text-su-black">
              Load {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} into cargo?
            </Text>

            <div className="flex flex-col gap-1 rounded border border-su-grey-light/40 bg-su-sand/20 p-3">
              {resultItems
                .filter((item) => selectedIds.has(item.entityId))
                .map((item) => (
                  <div key={item.entityId} className="flex items-center justify-between">
                    <Text as="span" className="text-sm text-su-black">
                      {item.name}
                    </Text>
                    <Text as="span" className="font-mono text-xs text-su-black/60">
                      {item.salvageValue} SV
                    </Text>
                  </div>
                ))}
            </div>

            {salvageType === 'mech' && sourceMechLabel && (
              <Text as="p" className="text-xs text-su-black/60">
                Source: {sourceMechLabel}
              </Text>
            )}

            <Text as="p" className="text-xs text-su-black/50">
              Slots used: {selectedSlotsUsed} / {remainingCapacity} available
            </Text>

            <div className="flex items-center justify-between border-t border-su-grey-light/30 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPhase('select-items')}
                disabled={isConfirming}
              >
                Back
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirm}
                disabled={isConfirming}
                className="bg-su-green text-su-white hover:bg-emerald-600 font-mono text-xs uppercase disabled:opacity-50"
              >
                {isConfirming ? 'Loading...' : 'Load Cargo'}
              </Button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  )
}
