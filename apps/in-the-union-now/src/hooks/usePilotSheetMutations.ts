import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { getErrorMessage } from '../lib/errors'
import type { PilotRow, MechRow, CrawlerRow, EntityRefRow, PilotUpdate } from '../types/common'
import type { PilotSheetData } from './usePilotSheetData'
import type { User } from '@supabase/supabase-js'
import { usePilotSheetPilotMutations } from './usePilotSheetPilotMutations'
import { usePilotSheetMechMutations } from './usePilotSheetMechMutations'

export type PilotSheetMutationDeps = {
  user: User
  pilot: PilotRow | undefined
  pilotRefs: EntityRefRow[]
  mech: MechRow | undefined
  mechRefs: EntityRefRow[]
  crawler: CrawlerRow | undefined
  chassisName: string | undefined
  mutations: PilotSheetData['mutations']
}

/**
 * Lifecycle handlers: delete, visibility, boarding, downtime toggles.
 * These are thin wrappers around handlePilotUpdate.
 */
function useLifecycleHandlers(
  deps: PilotSheetMutationDeps,
  handlePilotUpdate: (input: Partial<PilotUpdate>, toastMessage?: string) => void
) {
  const navigate = useNavigate()
  const { user, pilot, mech, chassisName, mutations } = deps
  const { deletePilot } = mutations

  const handleDelete = useCallback(() => {
    if (!user) return
    deletePilot.mutate(
      { pilotId: pilot?.id ?? '', userId: user.id },
      {
        onSuccess: () => {
          toast.success('Pilot deleted')
          navigate({ to: '/' })
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [user, pilot, deletePilot, navigate])

  const handleToggleVisibility = useCallback(() => {
    if (!pilot) return
    const msg = pilot.visible
      ? `${pilot.callsign} is now hidden`
      : `${pilot.callsign} is now visible`
    handlePilotUpdate({ visible: !pilot.visible }, msg)
  }, [pilot, handlePilotUpdate])

  const handleToggleBoarded = useCallback(() => {
    if (!pilot) return
    const mechLabel = mech?.pattern_name || chassisName || 'mech'
    const msg = pilot.is_boarded
      ? `${pilot.callsign} has disembarked ${mechLabel}`
      : `${pilot.callsign} has embarked ${mechLabel}`
    handlePilotUpdate({ is_boarded: !pilot.is_boarded }, msg)
  }, [pilot, mech, chassisName, handlePilotUpdate])

  const handleToggleDowntime = useCallback(() => {
    if (!pilot) return
    const entering = !pilot.in_downtime
    const msg = entering
      ? `${pilot.callsign} entered downtime`
      : `${pilot.callsign} exited downtime`
    handlePilotUpdate(
      entering ? { in_downtime: true, is_boarded: false } : { in_downtime: false },
      msg
    )
  }, [pilot, handlePilotUpdate])

  return {
    handleDelete,
    handleToggleVisibility,
    handleToggleBoarded,
    handleToggleDowntime,
    isDeleting: deletePilot.isPending,
  }
}

/**
 * All mutation handlers for the pilot sheet.
 * Composed from domain-specific sub-hooks for maintainability.
 */
export function usePilotSheetMutations(deps: PilotSheetMutationDeps) {
  const pilotMutations = usePilotSheetPilotMutations(deps)
  const mechMutations = usePilotSheetMechMutations(deps)
  const lifecycleHandlers = useLifecycleHandlers(deps, pilotMutations.handlePilotUpdate)

  return {
    ...pilotMutations,
    ...mechMutations,
    ...lifecycleHandlers,
  }
}
