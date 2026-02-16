import { useReducer, useMemo, useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefGuide } from 'salvageunion-reference'
import { EntityDisplay } from 'suref-react'
import { toast } from 'sonner'
import { actionButtonClasses } from '../../../../components/shared/actionButtonClasses'
import { useAuthStore } from '../../../../stores/authStore'
import { useCreateCrawler } from '../../../../hooks/useCrawlers'
import { useGuideInteractiveConfig } from '../../../../hooks/useGuideInteractiveConfig'
import {
  getDigitalSteps,
  createWizardReducer,
  createInitialWizardState,
  canSubmitWizard,
} from '../../../../lib/pilotUtils'
import { crawlerWizardToCreateInput } from '../../../../lib/crawlerUtils'
import { getErrorMessage } from '../../../../lib/errors'

export const Route = createFileRoute('/_authenticated/games/$gameId/create-crawler')({
  component: CreateCrawlerPage,
})

const crawlerGuide = SalvageUnionReference.Guides.find(
  (g) => g.name === 'Create a Crawler'
)! as SURefGuide

const digitalSteps = getDigitalSteps(crawlerGuide)

/** Guide entity with only digital steps (filters out paperOnly steps) */
const interactiveGuide = { ...crawlerGuide, steps: digitalSteps } as SURefGuide

function CreateCrawlerPage() {
  const { gameId } = Route.useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const createCrawler = useCreateCrawler()

  const reducer = useMemo(() => createWizardReducer(digitalSteps), [])
  const [state, dispatch] = useReducer(reducer, undefined, createInitialWizardState)

  const guideInteractive = useGuideInteractiveConfig(digitalSteps, state, dispatch)

  const isSubmittable = useMemo(() => canSubmitWizard(state, digitalSteps), [state])

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
    () => ({ ...guideInteractive, renderFooter }),
    [guideInteractive, renderFooter]
  )

  return (
    <div className="flex flex-col gap-4">
      <EntityDisplay data={interactiveGuide} interactive={interactive} />
    </div>
  )
}
