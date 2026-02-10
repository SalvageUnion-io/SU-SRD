import { lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'

const PilotsGrid = lazy(() =>
  import('../../../components/Dashboard/PilotsGrid').then((m) => ({ default: m.PilotsGrid }))
)

export const Route = createFileRoute('/dashboard/pilots/')({
  component: PilotsGrid,
  staticData: {
    ssr: false,
  },
})
