import { lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'

const PilotWizard = lazy(() =>
  import('../../../components/PilotWizard').then((m) => ({ default: m.PilotWizard }))
)

export const Route = createFileRoute('/dashboard/pilots/new')({
  component: PilotWizard,
  staticData: {
    ssr: false,
  },
})
