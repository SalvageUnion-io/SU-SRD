import { useReducer, useMemo, useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefGuide } from 'salvageunion-reference'
import { EntityDisplay } from 'suref-react'
import { toast } from 'sonner'
import { useAuthStore } from '../../../stores/authStore'
import { useCreatePilot } from '../../../hooks/usePilots'
import { useGuideInteractiveConfig } from '../../../components/pilots/InteractiveGuideSteps'
import {
  getDigitalSteps,
  createWizardReducer,
  createInitialWizardState,
  canSubmitWizard,
  wizardToCreateInput,
} from '../../../lib/pilotUtils'
import { getErrorMessage } from '../../../lib/errors'

export const Route = createFileRoute('/_authenticated/pilots/new')({
  component: NewPilotPage,
})

const pilotGuide = SalvageUnionReference.Guides.find(
  (g) => g.name === 'Create a Pilot'
)! as SURefGuide

const digitalSteps = getDigitalSteps(pilotGuide)

/** Guide entity with only digital steps (filters out paperOnly steps) */
const interactiveGuide = { ...pilotGuide, steps: digitalSteps } as SURefGuide

function NewPilotPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const createPilot = useCreatePilot()

  const reducer = useMemo(() => createWizardReducer(digitalSteps), [])
  const [state, dispatch] = useReducer(reducer, undefined, createInitialWizardState)

  const guideInteractive = useGuideInteractiveConfig(digitalSteps, state, dispatch)

  const isSubmittable = useMemo(() => canSubmitWizard(state, digitalSteps), [state])

  const handleSubmit = useCallback(() => {
    if (!user) return
    const input = wizardToCreateInput(state, digitalSteps)
    if (!input) {
      toast.error('Please complete all required steps.')
      return
    }

    createPilot.mutate(
      { userId: user.id, input },
      {
        onSuccess: (pilot) => {
          toast.success(`Pilot "${pilot.callsign}" created!`)
          navigate({ to: '/pilots/$pilotId/create-mech', params: { pilotId: pilot.id } })
        },
        onError: (error) => {
          toast.error(getErrorMessage(error))
        },
      }
    )
  }, [user, state, createPilot, navigate])

  const renderFooter = useCallback(
    () => (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isSubmittable || createPilot.isPending}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-su-green px-3 py-1.5 font-mono text-sm font-semibold uppercase text-su-white transition-colors hover:bg-emerald-600 disabled:pointer-events-none disabled:opacity-50"
        >
          {createPilot.isPending ? 'Creating...' : 'Create Pilot'}
        </button>
      </div>
    ),
    [handleSubmit, isSubmittable, createPilot.isPending]
  )

  const interactive = useMemo(
    () => ({ ...guideInteractive, renderFooter }),
    [guideInteractive, renderFooter]
  )

  return (
    <div className="flex flex-col gap-4">
      <EntityDisplay data={interactiveGuide} interactive={interactive} />
    </div>
  )
}
