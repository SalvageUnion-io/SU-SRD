import { useReducer, useMemo, useCallback, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefGuide, SURefObjectGuideStep } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from 'suref-react'
import { toast } from 'sonner'
import { actionButtonClasses } from '../../../../components/shared/actionButtonClasses'
import { useCurrentUser } from '../../../../hooks/useCurrentUser'
import { useCreateCrawler } from '../../../../hooks/useCrawlers'
import { useGuideInteractiveConfig } from '../../../../hooks/useGuideInteractiveConfig'
import {
  getDigitalSteps,
  createWizardReducer,
  createInitialWizardState,
} from '../../../../lib/pilotUtils'
import {
  crawlerWizardToCreateInput,
  crawlerConstraintOverride,
  canSubmitCrawlerWizard,
} from '../../../../lib/crawlerUtils'
import { getErrorMessage } from '../../../../lib/errors'
import {
  CrawlerNpcStepContent,
  getAllNpcChoiceIds,
} from '../../../../components/games/CrawlerNpcStepContent'

export const Route = createFileRoute('/_authenticated/games/$gameId/create-crawler')({
  component: CreateCrawlerPage,
})

const crawlerGuide = SalvageUnionReference.Guides.find(
  (g) => g.name === 'Create a Crawler'
)! as SURefGuide

const digitalSteps = getDigitalSteps(crawlerGuide)

const crawlerTypeStep = digitalSteps.find(
  (s) => s.stepType === 'select-one' && s.schema?.[0] === 'crawlers'
)!
const npcStep = digitalSteps.find(
  (s) => s.stepType === 'freeform' && s.schema?.[0] === 'crawler-bays'
)!

/** Guide entity with only digital steps (filters out paperOnly steps) */
const interactiveGuide = { ...crawlerGuide, steps: digitalSteps } as SURefGuide

function CreateCrawlerPage() {
  const { gameId } = Route.useParams()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const createCrawler = useCreateCrawler()

  const reducer = useMemo(() => createWizardReducer(digitalSteps, crawlerConstraintOverride), [])
  const [state, dispatch] = useReducer(reducer, undefined, createInitialWizardState)

  const guideInteractive = useGuideInteractiveConfig(
    digitalSteps,
    state,
    dispatch,
    undefined,
    crawlerConstraintOverride
  )

  // Derive selected crawler type ID from wizard state
  const selectedCrawlerTypeId = state.selections[crawlerTypeStep.id]?.selectedIds[0]

  // Initialize required NPC choices whenever the selected crawler type changes
  useEffect(() => {
    const requiredIds = getAllNpcChoiceIds(selectedCrawlerTypeId)
    if (requiredIds.length === 0) return
    const existing = state.selections[npcStep.id]
    // Only re-init if some required IDs are missing from choiceValues
    const needsInit = requiredIds.some((id) => !(id in (existing?.choiceValues ?? {})))
    if (needsInit) {
      dispatch({
        type: 'INIT_REQUIRED_CHOICES',
        stepId: npcStep.id,
        requiredChoiceIds: requiredIds,
      })
    }
  }, [selectedCrawlerTypeId, state.selections, dispatch])

  const onChoiceValueChange = useCallback(
    (stepId: string, choiceId: string, value: string) => {
      dispatch({ type: 'SET_CHOICE_VALUE', stepId, choiceId, value })
    },
    [dispatch]
  )

  const renderStepContent = useCallback(
    (step: SURefObjectGuideStep) => {
      if (step.id !== npcStep.id) return undefined
      const choiceValues = state.selections[npcStep.id]?.choiceValues ?? {}
      return (
        <CrawlerNpcStepContent
          stepId={npcStep.id}
          choiceValues={choiceValues}
          onChoiceValueChange={onChoiceValueChange}
          selectedCrawlerTypeId={selectedCrawlerTypeId}
        />
      )
    },
    [state.selections, onChoiceValueChange, selectedCrawlerTypeId]
  )

  const isSubmittable = useMemo(() => canSubmitCrawlerWizard(state, digitalSteps), [state])

  const handleSubmit = useCallback(() => {
    if (!user) return
    const input = crawlerWizardToCreateInput(state, digitalSteps)
    if (!input) {
      toast.error('Please complete all required steps.')
      return
    }

    createCrawler.mutate(
      { userId: user.id, gameId, input },
      {
        onSuccess: () => {
          toast.success('Crawler created!')
          navigate({ to: '/games/$gameId', params: { gameId } })
        },
        onError: (error) => {
          toast.error(getErrorMessage(error))
        },
      }
    )
  }, [user, state, gameId, createCrawler, navigate])

  const renderFooter = useCallback(
    () => (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isSubmittable || createCrawler.isPending}
          className={actionButtonClasses('green')}
        >
          {createCrawler.isPending ? 'Creating...' : 'Create Crawler'}
        </button>
      </div>
    ),
    [handleSubmit, isSubmittable, createCrawler.isPending]
  )

  const interactive = useMemo(
    () => ({ ...guideInteractive, renderFooter, renderStepContent }),
    [guideInteractive, renderFooter, renderStepContent]
  )

  return (
    <div className="flex flex-col gap-4">
      <ReferenceEntityDisplay data={interactiveGuide} interactive={interactive} />
    </div>
  )
}
