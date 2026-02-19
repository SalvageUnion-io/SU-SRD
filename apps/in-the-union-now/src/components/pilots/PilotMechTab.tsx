import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { showSaveToast } from '../../lib/toastUtils'
import { useAuthStore } from '../../stores/authStore'
import { useUpdateMech, useUpdateMechLoadout } from '../../hooks/useMechs'
import { useCreatePattern, usePattern } from '../../hooks/usePatterns'
import { useAutosave } from '../../hooks/useAutosave'
import { useSaveStatus } from '../../hooks/useSaveStatus'
import {
  entityRefsToBuilderState,
  builderStateToPatchOps,
  getMechSourcePattern,
} from '../../lib/mechUtils'
import { builderToCreateInput } from '../../lib/builderUtils'
import { hasDeviated, resolveSourcePatternItems } from '../../lib/deviationUtils'
import type { BuilderState } from '../../lib/builderUtils'
import type {
  SelectedPattern,
  PatternItem,
  PilotRow,
  MechRow,
  EntityRefRow,
} from '../../types/common'
import { MechBuilder } from '../patterns/MechBuilder'
import { SavePatternDialog } from '../patterns/SavePatternDialog'
import { RefPatternViewModal } from '../patterns/RefPatternViewModal'
import { PilotMechSection } from './PilotMechSection'
import { getErrorMessage } from '../../lib/errors'

type PilotMechTabProps = {
  pilot: PilotRow
  mech: MechRow | null | undefined
  mechRefs: EntityRefRow[]
  canEdit: boolean
  compact?: boolean
}

export function PilotMechTab({ pilot, mech, mechRefs, canEdit, compact }: PilotMechTabProps) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const updateLoadout = useUpdateMechLoadout()
  const updateMechMutation = useUpdateMech()
  const createPatternMutation = useCreatePattern()
  const [builderState, setBuilderState] = useState<BuilderState | null>(null)
  const [showSavePatternDialog, setShowSavePatternDialog] = useState(false)
  const [showRefPatternModal, setShowRefPatternModal] = useState(false)

  // No mech: show the empty state
  if (!pilot.mech_id || !mech) {
    return (
      <div className={compact ? 'p-3' : 'p-4'}>
        <PilotMechSection
          pilot={pilot}
          compact={compact}
          readOnly={!canEdit}
          mech={null}
          mechChassis={undefined}
          mechLoading={false}
        />
      </div>
    )
  }

  const sourcePattern = getMechSourcePattern(mech)

  const initialState = entityRefsToBuilderState(mech, mechRefs)

  return (
    <PilotMechTabInner
      pilot={pilot}
      mech={mech}
      mechRefs={mechRefs}
      canEdit={canEdit}
      compact={compact}
      sourcePattern={sourcePattern}
      initialState={initialState}
      user={user}
      navigate={navigate}
      updateLoadout={updateLoadout}
      updateMechMutation={updateMechMutation}
      createPatternMutation={createPatternMutation}
      builderState={builderState}
      setBuilderState={setBuilderState}
      showSavePatternDialog={showSavePatternDialog}
      setShowSavePatternDialog={setShowSavePatternDialog}
      showRefPatternModal={showRefPatternModal}
      setShowRefPatternModal={setShowRefPatternModal}
    />
  )
}

// Inner component avoids hooks after early return
function PilotMechTabInner({
  mech,
  mechRefs,
  canEdit,
  compact,
  sourcePattern,
  initialState,
  user,
  navigate,
  updateLoadout,
  updateMechMutation,
  createPatternMutation,
  builderState,
  setBuilderState,
  showSavePatternDialog,
  setShowSavePatternDialog,
  showRefPatternModal,
  setShowRefPatternModal,
}: {
  pilot: PilotRow
  mech: MechRow
  mechRefs: EntityRefRow[]
  canEdit: boolean
  compact?: boolean
  sourcePattern: ReturnType<typeof getMechSourcePattern>
  initialState: BuilderState
  user: { id: string } | null
  navigate: ReturnType<typeof useNavigate>
  updateLoadout: ReturnType<typeof useUpdateMechLoadout>
  updateMechMutation: ReturnType<typeof useUpdateMech>
  createPatternMutation: ReturnType<typeof useCreatePattern>
  builderState: BuilderState | null
  setBuilderState: (s: BuilderState | null) => void
  showSavePatternDialog: boolean
  setShowSavePatternDialog: (v: boolean) => void
  showRefPatternModal: boolean
  setShowRefPatternModal: (v: boolean) => void
}) {
  // Fetch linked player pattern for deviation detection
  const { data: linkedPlayerPattern } = usePattern(
    sourcePattern?.kind === 'player' ? sourcePattern.patternId : undefined
  )

  const isDeviated = useMemo(() => {
    if (!sourcePattern || !mechRefs) return false

    const mechItems: PatternItem[] = mechRefs
      .filter((r) => r.schema_name === 'systems' || r.schema_name === 'modules')
      .map((r) => ({
        schema_name: r.schema_name as 'systems' | 'modules',
        schema_ref_id: r.schema_ref_id,
        sort_order: r.sort_order,
      }))

    const sourceItems = resolveSourcePatternItems(sourcePattern, linkedPlayerPattern)
    if (!sourceItems) return false

    return hasDeviated(mechItems, sourceItems)
  }, [sourcePattern, mechRefs, linkedPlayerPattern])

  const canAutosave = !!user && builderState !== null && builderToCreateInput(builderState) !== null

  const handleAutosave = useCallback(
    (state: BuilderState | null) => {
      if (!user || !state) return
      const ops = builderStateToPatchOps(mechRefs, state, mech.id, user.id)
      updateLoadout.mutate(
        {
          mechId: mech.id,
          inserts: ops.inserts,
          deleteIds: ops.deleteIds,
        },
        {
          onSuccess: () => showSaveToast(),
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [user, mech.id, mechRefs, updateLoadout]
  )

  useAutosave({
    value: builderState,
    onSave: handleAutosave,
    enabled: canAutosave,
  })

  const handleSaveToPatterns = useCallback(
    (patternName: string) => {
      if (!user || !builderState) return
      const input = builderToCreateInput({ ...builderState, name: patternName })
      if (!input) return
      createPatternMutation.mutate(
        { userId: user.id, input },
        {
          onSuccess: (newPattern) => {
            setShowSavePatternDialog(false)
            toast.success('Pattern saved!')
            updateMechMutation.mutate({
              mechId: mech.id,
              input: { source_pattern_id: newPattern.id, source_ref_pattern_id: null },
            })
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [
      user,
      mech.id,
      builderState,
      createPatternMutation,
      updateMechMutation,
      setShowSavePatternDialog,
    ]
  )

  const handlePatternApplied = useCallback(
    (selection: SelectedPattern) => {
      if (selection.source === 'reference') {
        updateMechMutation.mutate({
          mechId: mech.id,
          input: { source_ref_pattern_id: selection.refPatternId, source_pattern_id: null },
        })
      } else {
        updateMechMutation.mutate({
          mechId: mech.id,
          input: { source_pattern_id: selection.pattern.id, source_ref_pattern_id: null },
        })
      }
    },
    [mech.id, updateMechMutation]
  )

  const handleViewPattern = useCallback(() => {
    if (!sourcePattern) return
    if (sourcePattern.kind === 'player') {
      navigate({ to: '/patterns/$patternId', params: { patternId: sourcePattern.patternId } })
    } else {
      setShowRefPatternModal(true)
    }
  }, [sourcePattern, navigate, setShowRefPatternModal])

  const saveStatus = useSaveStatus({ isSaving: updateLoadout.isPending })

  if (!canEdit) {
    return (
      <div className={compact ? 'p-3' : 'p-4'}>
        <MechBuilder initialState={initialState} readOnly compact={compact} stickyHeader={false} />
      </div>
    )
  }

  return (
    <>
      <div className={compact ? 'p-3' : 'p-4'}>
        <MechBuilder
          initialState={initialState}
          onChange={setBuilderState}
          saveStatus={saveStatus}
          compact={compact}
          stickyHeader={false}
          hideFooterToggles
          sourcePattern={sourcePattern}
          isDeviated={isDeviated}
          onViewPattern={sourcePattern ? handleViewPattern : undefined}
          onPatternApplied={handlePatternApplied}
          onSaveToPatterns={sourcePattern ? undefined : () => setShowSavePatternDialog(true)}
          isSavingToPatterns={createPatternMutation.isPending}
          userId={user?.id}
        />
      </div>
      <SavePatternDialog
        open={showSavePatternDialog}
        onOpenChange={setShowSavePatternDialog}
        defaultName={builderState?.name ?? initialState.name}
        onConfirm={handleSaveToPatterns}
        isSaving={createPatternMutation.isPending}
      />
      {showRefPatternModal && sourcePattern?.kind === 'reference' && (
        <RefPatternViewModal
          refPatternId={sourcePattern.refPatternId}
          open={showRefPatternModal}
          onOpenChange={setShowRefPatternModal}
        />
      )}
    </>
  )
}
