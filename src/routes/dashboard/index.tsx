import { lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'

const DashboardContent = lazy(() =>
  import('../../components/Dashboard/DashboardContent').then((m) => ({
    default: m.DashboardContent,
  }))
)

export const Route = createFileRoute('/dashboard/')({
  component: DashboardContent,
  staticData: {
    ssr: false,
  },
})
