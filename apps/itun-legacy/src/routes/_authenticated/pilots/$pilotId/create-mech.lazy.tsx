import { useReducer, useMemo, useCallback } from 'react'
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router'
import { SalvageUnionReference, getSalvageValue } from 'salvageunion-reference'
import type { SURefGuide, EntitySchemaName } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from 'suref-react'
import { toast } from 'sonner'
import { actionButtonClasses } from '../../../../components/shared/actionButtonClasses'
import { useCurrentUser } from '../../../../hooks/useCurrentUser'
import { useInstantiateMech } from '../../../../hooks/useMechs'
import { useGuideInteractiveConfig } from '../../../../hooks/useGuideInteractiveConfig'
import type { WizardBudgetConfig } from '../../../../hooks/useGuideInteractiveConfig'
import { STARTING_MECH_BUDGET } from '../../../../lib/builderUtils'
import {
  getDigitalSteps,
  createWizardReducer,
  createInitialWizardState,
  canSubmitWizard,
  mechWizardToInstantiateInput,
} from '../../../../lib/pilotUtils'
import { getErrorMessage } from '../../../../lib/errors'

export const Route = createLazyFileRoute('/_authenticated/pilots/$pilotId/create-mech')({
  component: CreateMechPage,
})

const MECH_BUDGET_SCHEMAS = new Set(['chassis', 'systems', 'modules'])

function CreateMechPage() {
  const { pilotId } = Route.useParams()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const instantiateMech = useInstantiateMech()

  const { mechDigitalSteps, interactiveMechGuide } = useMemo(() => {
    const guide = SalvageUnionReference.Guides.find(
      (g) => g.name === 'Create a Mech'
    )! as SURefGuide

    const steps = getDigitalSteps(guide)

    return {
      mechDigitalSteps: steps,
      interactiveMechGuide: { ...guide, steps } as SURefGuide,
    }
  }, [])

  const mechReducer = useMemo(() => createWizardReducer(mechDigitalSteps), [mechDigitalSteps])
  const [wizardState, wizardDispatch] = useReducer(mechReducer, undefined, createInitialWizardState)

  const budgetConfig = useMemo((): WizardBudgetConfig => {
    let totalCost = 0
    for (const step of mechDigitalSteps) {
      const schemaName = step.schema?.[0]
      if (!schemaName || !MECH_BUDGET_SCHEMAS.has(schemaName)) continue
      const selection = wizardState.selections[step.id]
      if (!selection) continue
      for (const id of selection.selectedIds) {
        const entity = SalvageUnionReference.get(schemaName as EntitySchemaName, id)
        if (entity) totalCost += getSalvageValue(entity) ?? 0
      }
    }
    return {
      budget: STARTING_MECH_BUDGET,
      totalCost,
      remainingBudget: STARTING_MECH_BUDGET - totalCost,
      budgetSchemas: MECH_BUDGET_SCHEMAS,
    }
  }, [wizardState, mechDigitalSteps])

  const guideInteractive = useGuideInteractiveConfig(
    mechDigitalSteps,
    wizardState,
    wizardDispatch,
    budgetConfig
  )

  const isSubmittable = useMemo(
    () => canSubmitWizard(wizardState, mechDigitalSteps),
    [wizardState, mechDigitalSteps]
  )

  const handleSubmit = useCallback(() => {
    if (!user) return
    const input = mechWizardToInstantiateInput(wizardState, mechDigitalSteps)
    if (!input) {
      toast.error('Please complete all required steps.')
      return
    }
    instantiateMech.mutate(
      { userId: user.id, pilotId, input },
      {
        onSuccess: () => {
          toast.success('Starting mech created!')
          navigate({ to: '/pilots/$pilotId', params: { pilotId } })
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [user, pilotId, wizardState, mechDigitalSteps, instantiateMech, navigate])

  const renderFooter = useCallback(
    () => (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isSubmittable || instantiateMech.isPending}
          className={actionButtonClasses('green')}
        >
          {instantiateMech.isPending ? 'Creating...' : 'Create Mech'}
        </button>
      </div>
    ),
    [handleSubmit, isSubmittable, instantiateMech.isPending]
  )

  const interactive = useMemo(
    () => ({ ...guideInteractive, renderFooter }),
    [guideInteractive, renderFooter]
  )

  return (
    <div className="flex flex-col gap-4">
      <ReferenceEntityDisplay data={interactiveMechGuide} interactive={interactive} />
    </div>
  )
}
