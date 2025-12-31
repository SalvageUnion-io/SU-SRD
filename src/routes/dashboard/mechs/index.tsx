import { lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'

const MechsGrid = lazy(() =>
  import('../../../components/Dashboard/MechsGrid').then((m) => ({ default: m.MechsGrid }))
)

export const Route = createFileRoute('/dashboard/mechs/')({
  component: MechsGrid,
  staticData: {
    ssr: false,
  },
})
