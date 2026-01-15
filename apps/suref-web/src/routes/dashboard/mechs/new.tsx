import { lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'

const MechWizard = lazy(() => import('../../../components/MechWizard'))

export const Route = createFileRoute('/dashboard/mechs/new')({
  component: MechWizard,
  staticData: {
    ssr: false,
  },
})
