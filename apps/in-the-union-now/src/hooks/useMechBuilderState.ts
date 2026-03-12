import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { getChassisAbilities } from 'salvageunion-reference'
import type {
  BuilderState,
  ResolvedItem,
  CapacityInfo,
  SalvageValueInfo,
} from '../lib/builderUtils'
import {
  resolvePatternItems,
  computeCapacity,
  computeSalvageValue,
  applyPatternItems,
  referencePatternToItems,
  nextSortOrder,
  builderToCreateInput,
} from '../lib/builderUtils'
import type { CreatePatternInput, SelectedPattern } from '../types/common'
import type { BuilderSchemaName } from '../components/patterns/ReferenceEntitySelectionModal'
import { findChassisById } from '../lib/entityHelpers'
import type { SURefChassis, SURefMetaAction } from 'salvageunion-reference'

type ModalTarget = BuilderSchemaName | null

const emptyState: BuilderState = {
  name: '',
  chassisRef: null,
  description: '',
  visible: true,
  customImageUrl: null,
  items: [],
}

type UseMechBuilderStateOptions = {
  initialState?: BuilderState
  onChange?: (state: BuilderState) => void
  onSave?: (input: CreatePatternInput) => void
  onPatternApplied?: (selection: SelectedPattern) => void
}

type MechBuilderStateReturn = {
  state: BuilderState
  chassis: SURefChassis | undefined
  resolvedItems: ResolvedItem[]
  capacity: CapacityInfo
  salvageValue: SalvageValueInfo
  systemItems: ResolvedItem[]
  moduleItems: ResolvedItem[]
  chassisAbilities: SURefMetaAction[] | undefined
  canSave: boolean
  // Modal state
  modalTarget: ModalTarget
  setModalTarget: (target: ModalTarget) => void
  showPatternModal: boolean
  setShowPatternModal: (show: boolean) => void
  startingMechMode: boolean
  setStartingMechMode: React.Dispatch<React.SetStateAction<boolean>>
  // Mutations
  setName: (name: string) => void
  toggleVisible: () => void
  selectChassis: (chassisId: string) => void
  setCustomImage: (url: string | null) => void
  addItem: (schemaName: 'systems' | 'modules', entityId: string) => void
  removeItem: (sortOrder: number) => void
  handleModalSelect: (entityId: string) => void
  handlePatternSelect: (selection: SelectedPattern) => void
  handleSave: () => void
  reset: () => void
}

export function useMechBuilderState({
  initialState,
  onChange,
  onSave,
  onPatternApplied,
}: UseMechBuilderStateOptions): MechBuilderStateReturn {
  const [state, setState] = useState<BuilderState>(initialState ?? emptyState)
  const [modalTarget, setModalTarget] = useState<ModalTarget>(null)
  const [showPatternModal, setShowPatternModal] = useState(false)
  const [startingMechMode, setStartingMechMode] = useState(false)
  const initialStateRef = useRef(initialState ?? emptyState)
  const initialSerializedRef = useRef(JSON.stringify(initialState ?? emptyState))

  // Fire onChange on every state change after initial mount (autosave mode).
  // Compare against initial state instead of a ref flag to be Strict Mode safe.
  useEffect(() => {
    if (JSON.stringify(state) === initialSerializedRef.current) return
    onChange?.(state)
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  const chassis = useMemo(
    () => (state.chassisRef ? findChassisById(state.chassisRef) : undefined),
    [state.chassisRef]
  )

  const resolvedItems = useMemo(() => resolvePatternItems(state.items), [state.items])

  const capacity = useMemo(
    () => computeCapacity(chassis ?? null, resolvedItems),
    [chassis, resolvedItems]
  )

  const salvageValue = useMemo(
    () => computeSalvageValue(chassis ?? null, resolvedItems),
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

  const chassisAbilities = useMemo(
    () => (chassis ? getChassisAbilities(chassis) : undefined),
    [chassis]
  )

  const canSave = useMemo(() => {
    const input = builderToCreateInput(state)
    return input !== null && capacity.isValid
  }, [state, capacity.isValid])

  const handleSave = useCallback(() => {
    const input = builderToCreateInput(state)
    if (input && capacity.isValid && onSave) {
      onSave(input)
    }
  }, [state, capacity.isValid, onSave])

  const reset = useCallback(() => {
    setState(initialStateRef.current)
  }, [])

  function setName(name: string) {
    setState((s) => ({ ...s, name }))
  }

  function toggleVisible() {
    setState((s) => ({ ...s, visible: !s.visible }))
  }

  function selectChassis(chassisId: string) {
    setState((s) => ({ ...s, chassisRef: chassisId }))
  }

  function setCustomImage(url: string | null) {
    setState((s) => ({ ...s, customImageUrl: url }))
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

  function handlePatternSelect(selection: SelectedPattern) {
    if (selection.source === 'reference') {
      setState((s) => ({
        ...applyPatternItems(
          s,
          referencePatternToItems(selection.pattern.systems, selection.pattern.modules)
        ),
        name: selection.pattern.name,
      }))
    } else {
      setState((s) => ({
        ...applyPatternItems(s, selection.pattern.pattern_items),
        name: selection.pattern.name,
      }))
    }
    onPatternApplied?.(selection)
  }

  return {
    state,
    chassis,
    resolvedItems,
    capacity,
    salvageValue,
    systemItems,
    moduleItems,
    chassisAbilities,
    canSave,
    modalTarget,
    setModalTarget,
    showPatternModal,
    setShowPatternModal,
    startingMechMode,
    setStartingMechMode,
    setName,
    toggleVisible,
    selectChassis,
    setCustomImage,
    addItem,
    removeItem,
    handleModalSelect,
    handlePatternSelect,
    handleSave,
    reset,
  }
}
